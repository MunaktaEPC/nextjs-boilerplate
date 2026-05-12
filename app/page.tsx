"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Post {
  id: string;
  created_at: string;
  title: string;
  content: string;
  image_url: string;
  author_name: string;
  author_avatar: string;
  category: string;
  genre?: string;
  parent_id?: string;
  likes?: number;
}

export default function RoboCupPortalComplete() {
  const [view, setView] = useState<'home' | 'bbs' | 'bbs_read' | 'blog_list' | 'blog_write' | 'blog_read' | 'profile'>('home');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [profileName, setProfileName] = useState('名無しさん');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [coverPreview, setCoverPreview] = useState(''); 
  const [genre, setGenre] = useState('未分類');
  const [isNewGenre, setIsNewGenre] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);

  const [activeThread, setActiveThread] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<Post | null>(null);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);

  useEffect(() => {
    const savedName = localStorage.getItem('robocup_name');
    const savedAvatar = localStorage.getItem('robocup_avatar');
    const savedAdmin = localStorage.getItem('robocup_is_admin') === 'true';
    if (savedName) setProfileName(savedName);
    if (savedAvatar) { setProfileAvatar(savedAvatar); setAvatarPreview(savedAvatar); }
    if (savedAdmin) setIsAdmin(true);
    fetchData();
  }, []);

  async function fetchData() {
    const { data, error } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (data) setPosts(data as Post[]);
  }

  // ジャンルリストの作成（ブログ記事から抽出）
  const existingGenres = useMemo(() => {
    const allGenres = posts
      .filter(p => p.category === 'blog' && !p.parent_id)
      .map(p => p.genre || '未分類');
    return Array.from(new Set(allGenres)).filter(g => g !== '未分類').sort();
  }, [posts]);

  // ブログ記事一覧
  const blogArticles = useMemo(() => {
    return posts.filter(p => p.category === 'blog' && !p.parent_id);
  }, [posts]);

  const mainThreads = posts.filter(p => !p.parent_id && p.category !== 'blog');
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  async function uploadFile(file: File) {
    const fileName = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) return null;
    const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
    return { url: pub.publicUrl, name: file.name };
  }

  // 画像挿入のコアロジック
  async function handleFileInsert(e: React.ChangeEvent<HTMLInputElement>, target: 'post' | 'reply') {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const res = await uploadFile(file);
    if (res) {
      const isImg = file.type.startsWith('image/');
      const tag = isImg ? `\n![画像](${res.url})\n` : `\n[📎 ${res.name}](${res.url})\n`;
      
      if (target === 'post') {
        const el = textareaRef.current;
        if (el) {
          const start = el.selectionStart;
          const end = el.selectionEnd;
          const newVal = content.substring(0, start) + tag + content.substring(end);
          setContent(newVal);
          setTimeout(() => { el.focus(); el.setSelectionRange(start + tag.length, start + tag.length); }, 10);
        } else { setContent(prev => prev + tag); }
      } else {
        const el = replyTextareaRef.current;
        if (el) {
          const start = el.selectionStart;
          const end = el.selectionEnd;
          const newVal = replyContent.substring(0, start) + tag + replyContent.substring(end);
          setReplyContent(newVal);
          setTimeout(() => { el.focus(); el.setSelectionRange(start + tag.length, start + tag.length); }, 10);
        } else { setReplyContent(prev => prev + tag); }
      }
    }
    setLoading(false);
    e.target.value = '';
  }

  async function handleLike(post: Post) {
    const { error } = await supabase.from('posts').update({ likes: (post.likes || 0) + 1 }).eq('id', post.id);
    if (!error) fetchData();
  }

  async function saveProfile() {
    setLoading(true);
    let url = profileAvatar;
    if (avatarFile) {
      const res = await uploadFile(avatarFile);
      if (res) url = res.url;
    }
    localStorage.setItem('robocup_name', profileName);
    localStorage.setItem('robocup_avatar', url);
    setProfileAvatar(url);
    const isNowAdmin = adminPassInput === 'admin1234';
    localStorage.setItem('robocup_is_admin', isNowAdmin ? 'true' : 'false');
    setIsAdmin(isNowAdmin);
    alert("保存しました");
    setView('home');
    setLoading(false);
  }

  async function handleDelete(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("削除しますか？")) return;
    await supabase.from('posts').delete().eq('id', id);
    await supabase.from('posts').delete().eq('parent_id', id);
    fetchData();
    if (activeThread?.id === id) setView('bbs');
    if (activeArticle?.id === id) setView('blog_list');
  }

  async function handleBbsSubmit() {
    if (!title || !content) return;
    setLoading(true);
    await supabase.from('posts').insert([{ title, content, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    setTitle(''); setContent('');
    await fetchData();
    setView('bbs');
    setLoading(false);
  }

  async function handleReplySubmit(parentId: string) {
    if (!replyContent) return;
    setLoading(true);
    await supabase.from('posts').insert([{ content: replyContent, parent_id: parentId, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    setReplyContent(''); 
    await fetchData();
    setLoading(false);
  }

  async function handleBlogSubmit() {
    if (!title || !content) return;
    setLoading(true);
    const finalGenre = isNewGenre ? genre : genre;
    await supabase.from('posts').insert([{ title, content, image_url: coverPreview, author_name: profileName, author_avatar: profileAvatar, category: 'blog', genre: finalGenre }]);
    setTitle(''); setContent(''); setCoverPreview(''); setGenre('未分類');
    await fetchData();
    setView('blog_list'); 
    setLoading(false);
  }

  const renderContent = (text: string) => {
    if (!text) return null;
    return text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g).map((part, i) => {
      const img = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (img) return <img key={i} src={img[2]} style={{ maxWidth: '100%', borderRadius: '10px', margin: '15px 0', display: 'block', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />;
      const file = part.match(/\[(.*?)\]\((.*?)\)/);
      if (file) return <a key={i} href={file[2]} target="_blank" style={{ display: 'inline-block', backgroundColor: '#eee', padding: '8px 15px', borderRadius: '8px', textDecoration: 'none', color: '#5a3d8a', margin: '5px 0', fontWeight: 'bold' }}>📎 {file[1]}</a>;
      return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fcfaff', color: '#333', fontFamily: 'sans-serif' }}>
      
      <header style={{ backgroundColor: '#fff', borderBottom: '3px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 onClick={() => setView('home')} style={{ margin: 0, fontSize: '22px', color: '#5a3d8a', cursor: 'pointer', fontWeight: '900' }}>ROBOCUP PORTAL</h1>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 15px', backgroundColor: '#f3eef7', borderRadius: '30px' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/30'} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold' }}>{profileName}{isAdmin && ' (Admin)'}</span>
        </div>
      </header>

      <nav style={{ padding: '10px 40px', display: 'flex', gap: '15px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
        <button onClick={() => setView('home')} style={{ background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: view === 'home' ? '#5a3d8a' : '#999' }}>ホーム</button>
        <button onClick={() => setView('bbs')} style={{ background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: view.startsWith('bbs') ? '#5a3d8a' : '#999' }}>掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', fontWeight: 'bold', cursor: 'pointer', color: view.startsWith('blog') ? '#5a3d8a' : '#999' }}>ブログ</button>
      </nav>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' }}>
        
        {view === 'home' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div onClick={() => setView('bbs')} style={{ backgroundColor: '#fff', padding: '50px', borderRadius: '25px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}><h2>掲示板</h2></div>
            <div onClick={() => setView('blog_list')} style={{ backgroundColor: '#fff', padding: '50px', borderRadius: '25px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 10px 20px rgba(0,0,0,0.05)' }}><h2>ブログ</h2></div>
          </div>
        )}

        {view === 'bbs' && (
          <div>
            <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '20px', marginBottom: '30px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0 }}>新規スレッド</h3>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ddd' }} />
              <label style={{ cursor: 'pointer', backgroundColor: '#f3eef7', padding: '8px 15px', borderRadius: '8px', display: 'inline-block', marginBottom: '10px', fontWeight: 'bold' }}>
                📸 画像・ファイルを挿入 <input type="file" onChange={(e) => handleFileInsert(e, 'post')} style={{ display: 'none' }} />
              </label>
              <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="内容..." style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} />
              <button onClick={handleBbsSubmit} style={{ marginTop: '10px', backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', borderRadius: '8px', border: 'none', fontWeight: 'bold' }}>投稿</button>
            </div>
            {mainThreads.map(t => (
              <div key={t.id} onClick={() => { setActiveThread(t); setView('bbs_read'); }} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '10px', cursor: 'pointer', border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img src={t.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                <div style={{ flexGrow: 1 }}><b>{t.title}</b><br/><small>{t.author_name} · {new Date(t.created_at).toLocaleString()}</small></div>
                {isAdmin && <button onClick={(e) => handleDelete(t.id, e)} style={{ border: 'none', background: 'none' }}>🗑️</button>}
              </div>
            ))}
          </div>
        )}

        {view === 'bbs_read' && activeThread && (
          <div>
            <button onClick={() => setView('bbs')} style={{ marginBottom: '20px' }}>← 戻る</button>
            <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
              <h2>{activeThread.title}</h2>
              <div style={{ marginBottom: '20px' }}>{renderContent(activeThread.content)}</div>
              <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '30px 0' }} />
              {getReplies(activeThread.id).map((r, i) => (
                <div key={r.id} style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #fafafa' }}>
                  <small style={{ color: '#888' }}>{i + 2}: <b>{r.author_name}</b> {new Date(r.created_at).toLocaleString()}</small>
                  <div style={{ marginTop: '5px' }}>{renderContent(r.content)}</div>
                </div>
              ))}
              <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '15px' }}>
                <label style={{ cursor: 'pointer', backgroundColor: '#fff', padding: '6px 12px', borderRadius: '5px', border: '1px solid #ddd', display: 'inline-block', marginBottom: '10px', fontSize: '13px' }}>📸 画像挿入 <input type="file" onChange={(e) => handleFileInsert(e, 'reply')} style={{ display: 'none' }} /></label>
                <textarea ref={replyTextareaRef} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信を書く..." style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '8px', border: '1px solid #ddd' }} />
                <button onClick={() => handleReplySubmit(activeThread.id)} style={{ marginTop: '10px', backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 25px', borderRadius: '8px', border: 'none' }}>返信する</button>
              </div>
            </div>
          </div>
        )}

        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '30px' }}>
            <aside style={{ width: '220px' }}>
              <h3 style={{ borderBottom: '2px solid #5a3d8a', paddingBottom: '10px' }}>📁 ジャンル</h3>
              <div onClick={() => setSelectedGenre(null)} style={{ padding: '10px', cursor: 'pointer', color: !selectedGenre ? '#5a3d8a' : '#666', fontWeight: !selectedGenre ? 'bold' : 'normal' }}>すべて表示</div>
              {existingGenres.map(g => (
                <div key={g} onClick={() => setSelectedGenre(g)} style={{ padding: '10px', cursor: 'pointer', color: selectedGenre === g ? '#5a3d8a' : '#666', fontWeight: selectedGenre === g ? 'bold' : 'normal' }}>{g}</div>
              ))}
            </aside>
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}><h2>技術ブログ</h2><button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '10px 25px', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>＋ 記事を書く</button></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {blogArticles.filter(a => !selectedGenre || a.genre === selectedGenre).map(a => (
                  <div key={a.id} onClick={() => { setActiveArticle(a); setView('blog_read'); }} style={{ backgroundColor: '#fff', borderRadius: '15px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                    <div style={{ height: '160px', backgroundColor: '#eee' }}>{a.image_url && <img src={a.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                    <div style={{ padding: '15px' }}><small style={{ color: '#5a3d8a', fontWeight: 'bold' }}>{a.genre}</small><h4 style={{ margin: '5px 0' }}>{a.title}</h4><small>{a.author_name}</small></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'blog_read' && activeArticle && (
          <article style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
            <button onClick={() => setView('blog_list')} style={{ marginBottom: '20px' }}>← 戻る</button>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', borderRadius: '15px', marginBottom: '20px' }} />}
            <h1 style={{ marginBottom: '10px' }}>{activeArticle.title}</h1>
            <div style={{ fontSize: '18px', lineHeight: '1.8' }}>{renderContent(activeArticle.content)}</div>
            <div style={{ marginTop: '40px', textAlign: 'center' }}><button onClick={() => handleLike(activeArticle)} style={{ padding: '10px 30px', borderRadius: '30px', border: '2px solid #ff4d6d', color: '#ff4d6d', backgroundColor: '#fff', fontWeight: 'bold' }}>❤️ {activeArticle.likes || 0}</button></div>
            {isAdmin && <button onClick={() => handleDelete(activeArticle.id)} style={{ marginTop: '20px', color: '#ccc', border: 'none', background: 'none' }}>🗑️ 記事を削除</button>}
          </article>
        )}

        {view === 'blog_write' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '25px' }}>
            <h2>記事の執筆</h2>
            <div style={{ height: '200px', border: '2px dashed #ddd', borderRadius: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px', position: 'relative', overflow: 'hidden' }}>
              {coverPreview ? <img src={coverPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : "🖼️ 表紙画像を選択"}
              <input type="file" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const res = await uploadFile(f); if (res) setCoverPreview(res.url); } }} style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0 }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>ジャンル</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {isNewGenre ? (
                  <input type="text" placeholder="新規ジャンル名" onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '10px' }} />
                ) : (
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '10px' }}>
                    <option value="未分類">未分類</option>
                    {existingGenres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                )}
                <button onClick={() => setIsNewGenre(!isNewGenre)}>{isNewGenre ? "既存から選ぶ" : "新しく作る"}</button>
              </div>
            </div>
            <div style={{ backgroundColor: '#f3eef7', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
              <label style={{ cursor: 'pointer', backgroundColor: '#5a3d8a', color: '#fff', padding: '8px 15px', borderRadius: '5px', fontWeight: 'bold' }}>📸 本文に画像を挿入 <input type="file" onChange={(e) => handleFileInsert(e, 'post')} style={{ display: 'none' }} /></label>
            </div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', fontSize: '24px', marginBottom: '20px', padding: '10px', border: 'none', borderBottom: '2px solid #eee' }} />
            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文..." style={{ width: '100%', height: '400px', padding: '15px', border: '1px solid #eee', borderRadius: '10px' }} />
            <button onClick={handleBlogSubmit} style={{ width: '100%', marginTop: '20px', padding: '15px', backgroundColor: '#00c58e', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 'bold', fontSize: '18px' }}>公開する</button>
          </div>
        )}

        {view === 'profile' && (
          <div style={{ maxWidth: '450px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
            <h2 style={{ textAlign: 'center' }}>プロフィール設定</h2>
            <div style={{ marginBottom: '20px' }}>
              <label>表示名</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label>アイコン</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '5px' }}>
                <img src={avatarPreview || 'https://via.placeholder.com/60'} style={{ width: '60px', height: '60px', borderRadius: '50%' }} />
                <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} />
              </div>
            </div>
            <div style={{ backgroundColor: '#fff5f5', padding: '15px', borderRadius: '10px', marginBottom: '20px' }}>
              <label style={{ color: '#d32f2f', fontWeight: 'bold' }}>管理者パスワード</label>
              <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} placeholder="admin1234" style={{ width: '100%', padding: '10px', marginTop: '5px' }} />
            </div>
            <button onClick={saveProfile} style={{ width: '100%', padding: '12px', backgroundColor: '#5a3d8a', color: '#fff', borderRadius: '10px', border: 'none', fontWeight: 'bold' }}>設定を保存</button>
          </div>
        )}

      </main>
    </div>
  );
}
