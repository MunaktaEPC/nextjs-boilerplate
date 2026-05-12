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

  // テキストエリア操作用のRef（掲示板用と返信用の2つを確実に用意）
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
    const savedLikes = JSON.parse(localStorage.getItem('robocup_liked_ids') || '[]');
    if (savedName) setProfileName(savedName);
    if (savedAvatar) { setProfileAvatar(savedAvatar); setAvatarPreview(savedAvatar); }
    if (savedAdmin) setIsAdmin(true);
    setLikedPosts(savedLikes);
    fetchData();
  }, []);

  async function fetchData() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (data) setPosts(data as Post[]);
  }

  // ブログジャンルの自動抽出
  const blogArticles = useMemo(() => posts.filter(p => p.category === 'blog' && !p.parent_id), [posts]);
  const existingGenres = useMemo(() => {
    const gs = Array.from(new Set(blogArticles.map(a => a.genre || '未分類')));
    return gs.filter(g => g !== '未分類').sort();
  }, [blogArticles]);

  const mainThreads = posts.filter(p => !p.parent_id && p.category !== 'blog');
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  async function uploadFile(file: File) {
    const fileName = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) return null;
    const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
    return { url: pub.publicUrl, name: file.name };
  }

  // 画像・ファイルをカーソル位置に挿入する関数
  async function handleFileInsert(e: React.ChangeEvent<HTMLInputElement>, target: 'post' | 'reply') {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const res = await uploadFile(file);
    if (res) {
      const tag = file.type.startsWith('image/') ? `\n![画像](${res.url})\n` : `\n[📎 ${res.name}](${res.url})\n`;
      const textarea = target === 'post' ? textareaRef.current : replyTextareaRef.current;
      const currentVal = target === 'post' ? content : replyContent;
      const setter = target === 'post' ? setContent : setReplyContent;

      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        setter(currentVal.substring(0, start) + tag + currentVal.substring(end));
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 10);
      } else {
        setter(prev => prev + tag);
      }
    }
    setLoading(false);
    e.target.value = ''; 
  }

  async function handleLike(post: Post) {
    if (likedPosts.includes(post.id)) return;
    const newList = [...likedPosts, post.id];
    setLikedPosts(newList);
    localStorage.setItem('robocup_liked_ids', JSON.stringify(newList));
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: (p.likes || 0) + 1 } : p));
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
    if (activeThread?.id === id) setView('bbs');
    if (activeArticle?.id === id) setView('blog_list');
    await fetchData();
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
    await supabase.from('posts').insert([{ title, content, image_url: coverPreview, author_name: profileName, author_avatar: profileAvatar, category: 'blog', genre: genre || '未分類' }]);
    setTitle(''); setContent(''); setCoverPreview(''); setGenre('未分類');
    await fetchData();
    setView('blog_list'); 
    setLoading(false);
  }

  const renderContent = (text: string) => {
    if (!text) return null;
    return text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g).map((part, i) => {
      const img = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (img) return <img key={i} src={img[2]} style={{ maxWidth: '100%', borderRadius: '12px', margin: '15px 0', display: 'block', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }} />;
      const file = part.match(/\[(.*?)\]\((.*?)\)/);
      if (file) return <a key={i} href={file[2]} target="_blank" style={{ display: 'inline-block', backgroundColor: '#eee', padding: '8px 15px', borderRadius: '8px', textDecoration: 'none', color: '#5a3d8a', margin: '5px 0' }}>📎 {file[1]}</a>;
      return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fcfaff', color: '#333', fontFamily: 'sans-serif' }}>
      
      {/* ヘッダー */}
      <header style={{ backgroundColor: '#fff', borderBottom: '3px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
        <h1 onClick={() => setView('home')} style={{ margin: 0, fontSize: '24px', color: '#5a3d8a', cursor: 'pointer', fontWeight: '900' }}>ROBOCUP PORTAL</h1>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '8px 18px', backgroundColor: '#f3eef7', borderRadius: '30px' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/35'} style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold' }}>{profileName}{isAdmin && ' (Admin)'}</span>
        </div>
      </header>

      {/* ナビ */}
      <nav style={{ padding: '10px 40px', display: 'flex', gap: '15px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
        <button onClick={() => setView('home')} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', backgroundColor: view === 'home' ? '#5a3d8a' : 'transparent', color: view === 'home' ? '#fff' : '#666', fontWeight: 'bold', cursor: 'pointer' }}>ホーム</button>
        <button onClick={() => setView('bbs')} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', backgroundColor: view.startsWith('bbs') ? '#5a3d8a' : 'transparent', color: view.startsWith('bbs') ? '#fff' : '#666', fontWeight: 'bold', cursor: 'pointer' }}>掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : 'transparent', color: view.startsWith('blog') ? '#fff' : '#666', fontWeight: 'bold', cursor: 'pointer' }}>ブログ</button>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        
        {view === 'home' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
            <div onClick={() => setView('bbs')} style={{ backgroundColor: '#fff', padding: '60px', borderRadius: '30px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
              <div style={{ fontSize: '60px', marginBottom: '20px' }}>💬</div><h2 style={{ color: '#5a3d8a' }}>交流掲示板</h2>
            </div>
            <div onClick={() => setView('blog_list')} style={{ backgroundColor: '#fff', padding: '60px', borderRadius: '30px', textAlign: 'center', cursor: 'pointer', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
              <div style={{ fontSize: '60px', marginBottom: '20px' }}>🖋️</div><h2 style={{ color: '#5a3d8a' }}>技術ブログ</h2>
            </div>
          </div>
        )}

        {/* 掲示板 */}
        {view === 'bbs' && (
          <div>
            <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '20px', marginBottom: '40px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
              <h3 style={{ marginTop: 0, color: '#5a3d8a' }}>新規スレッド作成</h3>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="スレッドのタイトル" style={{ width: '100%', padding: '15px', marginBottom: '15px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '16px' }} />
              <div style={{ marginBottom: '10px' }}>
                <label style={{ cursor: 'pointer', backgroundColor: '#f3eef7', padding: '8px 15px', borderRadius: '8px', color: '#5a3d8a', fontWeight: 'bold' }}>
                  📸 画像・ファイルを挿入 <input type="file" onChange={(e) => handleFileInsert(e, 'post')} style={{ display: 'none' }} />
                </label>
              </div>
              <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="内容を入力..." style={{ width: '100%', height: '120px', padding: '15px', borderRadius: '10px', border: '1px solid #ddd', fontSize: '16px' }} />
              <button onClick={handleBbsSubmit} disabled={loading} style={{ marginTop: '15px', backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 40px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>投稿する</button>
            </div>
            {mainThreads.map(t => (
              <div key={t.id} onClick={() => { setActiveThread(t); setView('bbs_read'); }} style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '18px', marginBottom: '15px', cursor: 'pointer', border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '20px', transition: '0.2s' }}>
                <img src={t.author_avatar || 'https://via.placeholder.com/50'} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ flexGrow: 1 }}><h4 style={{ margin: 0, fontSize: '18px', color: '#d32f2f' }}>{t.title}</h4><small>{t.author_name} · {new Date(t.created_at).toLocaleString()}</small></div>
                {isAdmin && <button onClick={(e) => handleDelete(t.id, e)} style={{ border: 'none', background: 'transparent', fontSize: '20px' }}>🗑️</button>}
              </div>
            ))}
          </div>
        )}

        {/* 掲示板詳細 */}
        {view === 'bbs_read' && activeThread && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <button onClick={() => setView('bbs')} style={{ marginBottom: '20px', background: 'none', border: 'none', color: '#5a3d8a', fontWeight: 'bold', cursor: 'pointer' }}>← 掲示板一覧へ戻る</button>
            <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
              <h2 style={{ color: '#5a3d8a', borderBottom: '2px solid #f3eef7', paddingBottom: '15px' }}>{activeThread.title}</h2>
              <div style={{ marginBottom: '30px' }}>
                <div style={{ fontSize: '14px', marginBottom: '10px' }}><span style={{ color: 'green', fontWeight: 'bold' }}>1</span> : <b>{activeThread.author_name}</b> : {new Date(activeThread.created_at).toLocaleString()}</div>
                <div style={{ paddingLeft: '10px', fontSize: '17px', lineHeight: '1.8' }}>{renderContent(activeThread.content)}</div>
              </div>
              {getReplies(activeThread.id).map((r, i) => (
                <div key={r.id} style={{ padding: '20px 0', borderTop: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: '14px', marginBottom: '8px' }}><span style={{ color: 'green', fontWeight: 'bold' }}>{i + 2}</span> : <b>{r.author_name}</b> : {new Date(r.created_at).toLocaleString()} {isAdmin && <button onClick={() => handleDelete(r.id)} style={{ marginLeft: '10px', border: 'none', background: 'none', color: '#ccc' }}>削除</button>}</div>
                  <div style={{ paddingLeft: '10px', lineHeight: '1.7' }}>{renderContent(r.content)}</div>
                </div>
              ))}
            </div>
            <div style={{ backgroundColor: '#f3eef7', padding: '30px', borderRadius: '25px' }}>
              <h4 style={{ marginTop: 0 }}>💬 レスを投稿する</h4>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ cursor: 'pointer', backgroundColor: '#fff', padding: '8px 15px', borderRadius: '8px', fontSize: '13px', fontWeight: 'bold' }}>📸 画像挿入 <input type="file" onChange={(e) => handleFileInsert(e, 'reply')} style={{ display: 'none' }} /></label>
              </div>
              <textarea ref={replyTextareaRef} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="書き込み内容..." style={{ width: '100%', height: '150px', padding: '15px', borderRadius: '15px', border: '1px solid #ddd' }} />
              <button onClick={() => handleReplySubmit(activeThread.id)} disabled={loading} style={{ width: '100%', marginTop: '15px', backgroundColor: '#5a3d8a', color: '#fff', padding: '15px', borderRadius: '15px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>書き込む</button>
            </div>
          </div>
        )}

        {/* ブログ一覧 */}
        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '40px' }}>
            <aside style={{ width: '240px' }}>
              <h3 style={{ borderBottom: '3px solid #5a3d8a', paddingBottom: '10px', color: '#5a3d8a' }}>📁 ジャンル</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li onClick={() => setSelectedGenre(null)} style={{ padding: '12px 15px', cursor: 'pointer', borderRadius: '10px', backgroundColor: !selectedGenre ? '#5a3d8a' : 'transparent', color: !selectedGenre ? '#fff' : '#666', fontWeight: 'bold', marginBottom: '5px' }}>すべて表示</li>
                {existingGenres.map(g => (
                  <li key={g} onClick={() => setSelectedGenre(g)} style={{ padding: '12px 15px', cursor: 'pointer', borderRadius: '10px', backgroundColor: selectedGenre === g ? '#5a3d8a' : 'transparent', color: selectedGenre === g ? '#fff' : '#666', fontWeight: 'bold', marginBottom: '5px' }}>{g}</li>
                ))}
              </ul>
            </aside>
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <h2 style={{ margin: 0, color: '#5a3d8a' }}>技術ブログ</h2>
                <button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '12px 30px', borderRadius: '30px', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,197,142,0.3)' }}>記事を書く</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px' }}>
                {blogArticles.filter(a => !selectedGenre || a.genre === selectedGenre).map(a => (
                  <article key={a.id} onClick={() => { setActiveArticle(a); setView('blog_read'); }} style={{ backgroundColor: '#fff', borderRadius: '25px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.05)', transition: '0.3s', border: '1px solid #f0f0f0' }}>
                    <div style={{ height: '180px', backgroundColor: '#f3eef7' }}>{a.image_url && <img src={a.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                    <div style={{ padding: '25px' }}>
                      <span style={{ fontSize: '12px', color: '#5a3d8a', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px' }}>{a.genre}</span>
                      <h3 style={{ margin: '10px 0', fontSize: '20px' }}>{a.title}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={a.author_avatar || 'https://via.placeholder.com/25'} style={{ width: '25px', height: '25px', borderRadius: '50%' }} />
                        <small>{a.author_name} · {new Date(a.created_at).toLocaleDateString()}</small>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ブログ詳細 */}
        {view === 'blog_read' && activeArticle && (
          <article style={{ maxWidth: '850px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '30px', padding: '50px', boxShadow: '0 15px 50px rgba(0,0,0,0.05)' }}>
            <button onClick={() => setView('blog_list')} style={{ marginBottom: '30px', background: 'none', border: 'none', color: '#5a3d8a', fontWeight: 'bold', cursor: 'pointer' }}>← 記事一覧へ</button>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', borderRadius: '20px', marginBottom: '40px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />}
            <span style={{ color: '#5a3d8a', fontWeight: 'bold' }}>{activeArticle.genre}</span>
            <h1 style={{ fontSize: '36px', marginTop: '10px', marginBottom: '20px' }}>{activeArticle.title}</h1>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', paddingBottom: '30px', marginBottom: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <img src={activeArticle.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                <b>{activeArticle.author_name}</b>
                <small>{new Date(activeArticle.created_at).toLocaleString()}</small>
              </div>
              {isAdmin && <button onClick={() => handleDelete(activeArticle.id)} style={{ color: '#ff4d6d', border: 'none', background: 'none', fontWeight: 'bold' }}>🗑️ 記事を削除</button>}
            </div>
            <div style={{ fontSize: '19px', lineHeight: '2.2', color: '#444' }}>{renderContent(activeArticle.content)}</div>
            <div style={{ textAlign: 'center', marginTop: '60px' }}>
              <button onClick={() => handleLike(activeArticle)} style={{ padding: '15px 40px', borderRadius: '40px', border: '2px solid #ff4d6d', backgroundColor: likedPosts.includes(activeArticle.id) ? '#ff4d6d' : '#fff', color: likedPosts.includes(activeArticle.id) ? '#fff' : '#ff4d6d', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}>❤️ {activeArticle.likes || 0}</button>
            </div>
          </article>
        )}

        {/* ブログ執筆 */}
        {view === 'blog_write' && (
          <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#fff', padding: '50px', borderRadius: '30px', boxShadow: '0 15px 50px rgba(0,0,0,0.05)' }}>
            <h2 style={{ color: '#5a3d8a', marginTop: 0 }}>新しい記事を書く</h2>
            <div style={{ margin: '30px 0', height: '250px', border: '3px dashed #eee', borderRadius: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', backgroundColor: '#fafafa' }}>
              {coverPreview ? <img src={coverPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div>🖼️ 表紙画像を設定</div>}
              <input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const res = await uploadFile(f); if (res) setCoverPreview(res.url); } }} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </div>
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>ジャンル</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {!isNewGenre ? (
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }}>
                    <option value="未分類">未分類</option>
                    {existingGenres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="新しいジャンル名" onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
                )}
                <button onClick={() => setIsNewGenre(!isNewGenre)} style={{ padding: '0 20px', borderRadius: '10px', border: '1px solid #5a3d8a', color: '#5a3d8a', background: 'none', fontWeight: 'bold' }}>{isNewGenre ? '既存から選ぶ' : '新規作成'}</button>
              </div>
            </div>
            <div style={{ backgroundColor: '#f3eef7', padding: '20px', borderRadius: '15px', marginBottom: '25px' }}>
              <label style={{ cursor: 'pointer', backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 25px', borderRadius: '10px', fontWeight: 'bold', display: 'inline-block' }}>📸 本文に画像を挿入 <input type="file" onChange={(e) => handleFileInsert(e, 'post')} style={{ display: 'none' }} /></label>
            </div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトルを入力..." style={{ width: '100%', fontSize: '30px', fontWeight: 'bold', border: 'none', borderBottom: '2px solid #eee', marginBottom: '30px', outline: 'none', padding: '10px 0' }} />
            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="ここから本文を書き始めましょう..." style={{ width: '100%', minHeight: '450px', padding: '20px', fontSize: '18px', border: '1px solid #eee', borderRadius: '15px', lineHeight: '1.8' }} />
            <button onClick={handleBlogSubmit} disabled={loading} style={{ width: '100%', marginTop: '30px', backgroundColor: '#00c58e', color: '#fff', padding: '18px', borderRadius: '18px', border: 'none', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 5px 20px rgba(0,197,142,0.3)' }}>記事を公開する</button>
          </div>
        )}

        {/* プロフィール */}
        {view === 'profile' && (
          <section style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#fff', padding: '50px', borderRadius: '30px', boxShadow: '0 15px 50px rgba(0,0,0,0.05)' }}>
            <h2 style={{ textAlign: 'center', color: '#5a3d8a', marginBottom: '30px' }}>ユーザー設定</h2>
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px' }}>表示名</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ddd' }} />
            </div>
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '15px' }}>アイコン設定</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '25px' }}>
                <img src={avatarPreview || 'https://via.placeholder.com/80'} style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f3eef7' }} />
                <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} style={{ fontSize: '12px' }} />
              </div>
            </div>
            <div style={{ padding: '20px', backgroundColor: '#fff5f5', borderRadius: '15px', marginBottom: '30px', border: '1px solid #ffebeb' }}>
              <label style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '13px' }}>管理者パスワード</label>
              <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} placeholder="削除権限用" style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ffcccc', marginTop: '5px' }} />
            </div>
            <button onClick={saveProfile} style={{ width: '100%', padding: '15px', backgroundColor: '#5a3d8a', color: '#fff', borderRadius: '15px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>保存して戻る</button>
          </section>
        )}
      </main>
    </div>
  );
}
