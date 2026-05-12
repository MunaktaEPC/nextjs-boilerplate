"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase設定
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

  const blogArticles = useMemo(() => posts.filter(p => p.category === 'blog' && !p.parent_id), [posts]);
  const existingGenres = useMemo(() => {
    const gs = Array.from(new Set(blogArticles.map(a => a.genre || '未分類')));
    return gs.filter(g => g !== '未分類').sort();
  }, [blogArticles]);

  const mainThreads = posts.filter(p => !p.parent_id && p.category !== 'blog');
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  async function uploadFile(file: File) {
    try {
      const fileName = `${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage.from('images').upload(fileName, file);
      if (error) throw error;
      const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
      return { url: pub.publicUrl, name: file.name };
    } catch (err) {
      console.error(err);
      return null;
    }
  }

  async function handleFileInsert(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const res = await uploadFile(file);
    if (res) {
      const tag = file.type.startsWith('image/') ? `\n![画像](${res.url})\n` : `\n[📎 ${res.name}](${res.url})\n`;
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = content.substring(0, start) + tag + content.substring(end);
        setContent(newContent);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 10);
      } else {
        setContent(prev => prev + tag);
      }
    }
    setLoading(false);
  }

  async function handleLike(post: Post) {
    if (likedPosts.includes(post.id)) return;
    const newLikedList = [...likedPosts, post.id];
    setLikedPosts(newLikedList);
    localStorage.setItem('robocup_liked_ids', JSON.stringify(newLikedList));
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: (p.likes || 0) + 1 } : p));
  }

  async function saveProfile() {
    setLoading(true);
    let newAvatarUrl = profileAvatar;
    if (avatarFile) {
      const res = await uploadFile(avatarFile);
      if (res) newAvatarUrl = res.url;
    }
    localStorage.setItem('robocup_name', profileName);
    localStorage.setItem('robocup_avatar', newAvatarUrl);
    setProfileAvatar(newAvatarUrl);
    if (adminPassInput === 'admin1234') {
      localStorage.setItem('robocup_is_admin', 'true');
      setIsAdmin(true);
    } else {
      localStorage.setItem('robocup_is_admin', 'false');
      setIsAdmin(false);
    }
    alert("設定を保存しました");
    setView('home');
    setLoading(false);
  }

  // ★★★ 削除処理の修正 ★★★
  async function handleDeletePost(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation(); // 一覧でクリックした時に詳細画面に飛ばないようにする
    if (!confirm("この記事を削除してもよろしいですか？（返信がある場合はそれも消えます）")) return;
    
    setLoading(true);
    try {
      // 親投稿（ブログまたはスレッド）を削除
      const { error: err1 } = await supabase.from('posts').delete().eq('id', id);
      // その投稿に紐付く返信（掲示板用）も削除
      const { error: err2 } = await supabase.from('posts').delete().eq('parent_id', id);
      
      if (err1 || err2) throw new Error("削除に失敗しました");
      
      alert("削除が完了しました");
      // 画面を一覧に戻す
      if (view === 'bbs_read') setView('bbs');
      if (view === 'blog_read') setView('blog_list');
      await fetchData();
    } catch (err) {
      alert("削除中にエラーが発生しました");
    } finally {
      setLoading(false);
    }
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
    await supabase.from('posts').insert([{ content: replyContent, parent_id: parentId, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    setReplyContent(''); 
    await fetchData();
  }

  async function handleBlogSubmit() {
    if (!title || !content) { alert("タイトルと本文を入力してください"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('posts').insert([{ 
        title, content, image_url: coverPreview, author_name: profileName, author_avatar: profileAvatar, category: 'blog', genre: genre || '未分類'
      }]);
      if (error) throw error;
      setTitle(''); setContent(''); setCoverPreview(''); setGenre('未分類');
      await fetchData();
      setView('blog_list'); 
    } catch (err) {
      alert("投稿に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  const renderContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g);
    return parts.map((part, index) => {
      const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) return <img key={index} src={imgMatch[2]} alt={imgMatch[1]} style={{ maxWidth: '100%', borderRadius: '8px', margin: '15px 0', display: 'block', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }} />;
      const fileMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (fileMatch) return (
        <a key={index} href={fileMatch[2]} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#f0f0f0', padding: '10px 18px', borderRadius: '8px', textDecoration: 'none', color: '#5a3d8a', fontWeight: 'bold', margin: '8px 0', border: '1px solid #ddd' }}>
          📎 {fileMatch[1].replace('📎 ', '')}
        </a>
      );
      return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', color: '#333', fontFamily: 'sans-serif' }}>
      
      <header style={{ backgroundColor: '#fff', borderBottom: '3px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 onClick={() => setView('home')} style={{ margin: 0, fontSize: '22px', color: '#5a3d8a', cursor: 'pointer', fontWeight: '900' }}>ロボカップ情報共有</h1>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 15px', backgroundColor: '#f3eef7', borderRadius: '30px' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/30'} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{profileName}{isAdmin && ' (Admin)'}</span>
        </div>
      </header>

      <nav style={{ padding: '12px 40px', display: 'flex', gap: '10px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
        <button onClick={() => setView('home')} style={{ padding: '8px 25px', border: 'none', borderRadius: '5px', backgroundColor: view === 'home' ? '#5a3d8a' : 'transparent', color: view === 'home' ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>🏠 ホーム</button>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 25px', border: 'none', borderRadius: '5px', backgroundColor: view.startsWith('bbs') ? '#5a3d8a' : 'transparent', color: view.startsWith('bbs') ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>💬 掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '8px 25px', border: 'none', borderRadius: '5px', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : 'transparent', color: view.startsWith('blog') ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>🖋️ ブログ</button>
      </nav>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' }}>
        
        {view === 'home' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '25px' }}>
            <div onClick={() => setView('bbs')} style={{ backgroundColor: '#fff', padding: '50px 20px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '1px solid #eee' }}>
              <div style={{ fontSize: '50px' }}>💬</div><h3>交流掲示板</h3>
            </div>
            <div onClick={() => setView('blog_list')} style={{ backgroundColor: '#fff', padding: '50px 20px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '1px solid #eee' }}>
              <div style={{ fontSize: '50px' }}>🖋️</div><h3>技術ブログ</h3>
            </div>
          </div>
        )}

        {view === 'bbs' && (
          <div>
            <div style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', marginBottom: '30px', border: '1px solid #e0d5ed' }}>
              <h3 style={{ marginTop: 0 }}>新規スレッド作成</h3>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px' }} />
              <div style={{ marginBottom: '10px' }}>
                <label style={{ cursor: 'pointer', backgroundColor: '#fff', padding: '6px 15px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '13px' }}>
                  📎 画像/ファイルを挿入 <input type="file" onChange={handleFileInsert} style={{ display: 'none' }} />
                </label>
              </div>
              <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文" style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '8px' }} />
              <button onClick={handleBbsSubmit} disabled={loading} style={{ marginTop: '10px', backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 35px', borderRadius: '8px', cursor: 'pointer' }}>投稿</button>
            </div>
            {mainThreads.map(t => (
              <article key={t.id} onClick={() => { setActiveThread(t); setView('bbs_read'); }} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', cursor: 'pointer', border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <img src={t.author_avatar || 'https://via.placeholder.com/45'} style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
                <div style={{ flexGrow: 1 }}><h4 style={{ margin: 0, color: '#d32f2f' }}>{t.title}</h4><small>{t.author_name} · {new Date(t.created_at).toLocaleString()}</small></div>
                {isAdmin && <button onClick={(e) => handleDeletePost(t.id, e)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>🗑️</button>}
              </article>
            ))}
          </div>
        )}

        {view === 'bbs_read' && activeThread && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button onClick={() => setView('bbs')}>← 戻る</button>
              {isAdmin && <button onClick={() => handleDeletePost(activeThread.id)} style={{ backgroundColor: '#ff4d4f', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '5px' }}>この記事を削除</button>}
            </div>
            <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '20px', border: '1px solid #ddd', margin: '20px 0' }}>
              <h2>{activeThread.title}</h2>
              <div style={{ fontSize: '17px', lineHeight: '1.8' }}>{renderContent(activeThread.content)}</div>
            </div>
            {getReplies(activeThread.id).map(r => (
              <div key={r.id} style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                <div style={{ flexGrow: 1, backgroundColor: '#fff', padding: '18px', borderRadius: '15px', border: '1px solid #eee' }}>
                  <strong>{r.author_name}</strong>: {renderContent(r.content)}
                  {isAdmin && <button onClick={() => handleDeletePost(r.id)} style={{ float: 'right', opacity: 0.5 }}>🗑️</button>}
                </div>
              </div>
            ))}
            <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信を書く..." style={{ width: '100%', height: '80px', padding: '15px' }} />
            <button onClick={() => handleReplySubmit(activeThread.id)} style={{ marginTop: '10px' }}>返信する</button>
          </div>
        )}

        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '30px' }}>
            <aside style={{ width: '200px' }}>
              <h3 style={{ borderBottom: '2px solid #5a3d8a', paddingBottom: '10px' }}>📁 ジャンル</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li onClick={() => setSelectedGenre(null)} style={{ padding: '10px', cursor: 'pointer', color: !selectedGenre ? '#5a3d8a' : '#666', fontWeight: !selectedGenre ? 'bold' : 'normal' }}>すべて</li>
                {existingGenres.map(g => (
                  <li key={g} onClick={() => setSelectedGenre(g)} style={{ padding: '10px', cursor: 'pointer', color: selectedGenre === g ? '#5a3d8a' : '#666', fontWeight: selectedGenre === g ? 'bold' : 'normal' }}>{g}</li>
                ))}
              </ul>
            </aside>
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}>
                <h2>技術ブログ</h2>
                <button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '12px 28px', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold' }}>＋ 記事を書く</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
                {blogArticles.filter(a => !selectedGenre || a.genre === selectedGenre).map(a => (
                  <article key={a.id} onClick={() => { setActiveArticle(a); setView('blog_read'); }} style={{ backgroundColor: '#fff', borderRadius: '18px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #eee', position: 'relative' }}>
                    <div style={{ height: '170px', backgroundColor: '#eee' }}>{a.image_url && <img src={a.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                    <div style={{ padding: '20px' }}>
                      <span style={{ fontSize: '11px', color: '#5a3d8a', fontWeight: 'bold' }}>{a.genre}</span>
                      <h4 style={{ margin: '5px 0' }}>{a.title}</h4>
                      <small>{a.author_name} · {new Date(a.created_at).toLocaleDateString()}</small>
                    </div>
                    {isAdmin && <button onClick={(e) => handleDeletePost(a.id, e)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: '50%', width: '30px', height: '30px' }}>🗑️</button>}
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'blog_read' && activeArticle && (
          <article style={{ maxWidth: '850px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '25px', padding: '40px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <button onClick={() => setView('blog_list')}>← 戻る</button>
              {isAdmin && <button onClick={() => handleDeletePost(activeArticle.id)} style={{ backgroundColor: '#ff4d4f', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '5px' }}>この記事を削除</button>}
            </div>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', borderRadius: '15px', marginBottom: '30px' }} />}
            <span style={{ color: '#5a3d8a', fontWeight: 'bold' }}>{activeArticle.genre}</span>
            <h1 style={{ fontSize: '36px', marginTop: '10px' }}>{activeArticle.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', paddingBottom: '20px', borderBottom: '1px solid #eee' }}>
              <img src={activeArticle.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              <div><strong>{activeArticle.author_name}</strong><br/><small>{new Date(activeArticle.created_at).toLocaleString()}</small></div>
            </div>
            <div style={{ fontSize: '18px', lineHeight: '2.0' }}>{renderContent(activeArticle.content)}</div>
            <div style={{ marginTop: '50px', textAlign: 'center' }}>
              <button onClick={() => handleLike(activeArticle)} style={{ padding: '15px 40px', borderRadius: '40px', border: '2px solid #ff4d6d', backgroundColor: likedPosts.includes(activeArticle.id) ? '#ff4d6d' : 'white', color: likedPosts.includes(activeArticle.id) ? 'white' : '#ff4d6d', fontSize: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
                ❤️ {activeArticle.likes || 0} いいね！
              </button>
            </div>
          </article>
        )}

        {view === 'blog_write' && (
          <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '25px', border: '1px solid #ddd' }}>
            <button onClick={() => setView('blog_list')}>← キャンセル</button>
            
            <div style={{ margin: '30px 0', height: '250px', border: '2px dashed #ddd', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden', backgroundColor: '#fafafa' }}>
              {coverPreview ? <img src={coverPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>🖼️ 表紙画像を選択（任意）</span>}
              <input type="file" accept="image/*" onChange={async (e) => { 
                const f = e.target.files?.[0]; 
                if (f) { const res = await uploadFile(f); if (res) setCoverPreview(res.url); }
              }} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>📁 ジャンル</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {!isNewGenre ? (
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '12px', borderRadius: '10px' }}>
                    <option value="未分類">未分類</option>{existingGenres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="新規ジャンル名" onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '12px', borderRadius: '10px' }} />
                )}
                <button onClick={() => setIsNewGenre(!isNewGenre)}>{isNewGenre ? '選択に戻る' : '新規作成'}</button>
              </div>
            </div>
            
            <div style={{ backgroundColor: '#f3eef7', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
              <label style={{ cursor: 'pointer', backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 25px', borderRadius: '8px', fontWeight: 'bold' }}>
                📸 本文中に画像を挿入 <input type="file" onChange={handleFileInsert} style={{ display: 'none' }} />
              </label>
            </div>

            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル..." style={{ width: '100%', fontSize: '32px', fontWeight: 'bold', border: 'none', borderBottom: '2px solid #eee', marginBottom: '20px', outline: 'none' }} />
            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文..." style={{ width: '100%', minHeight: '400px', padding: '20px', fontSize: '17px', borderRadius: '15px', border: '1px solid #eee' }} />
            
            <button onClick={handleBlogSubmit} disabled={loading} style={{ width: '100%', backgroundColor: '#00c58e', color: '#fff', padding: '20px', borderRadius: '15px', fontSize: '20px', fontWeight: 'bold', marginTop: '30px', border: 'none', cursor: 'pointer' }}>記事を公開する</button>
          </div>
        )}

        {view === 'profile' && (
          <section style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '25px', border: '1px solid #ddd' }}>
            <h2 style={{ textAlign: 'center' }}>設定</h2>
            <div style={{ marginBottom: '20px' }}>
              <label>表示名</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '12px' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label>アイコン</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <img src={avatarPreview || 'https://via.placeholder.com/70'} style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover' }} />
                <input type="file" onChange={async (e) => { 
                  const f = e.target.files?.[0]; 
                  if (f) { const res = await uploadFile(f); if (res) { setProfileAvatar(res.url); setAvatarPreview(res.url); } }
                }} />
              </div>
            </div>
            <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '10px' }}>
              <label>管理者パスワード</label>
              <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} placeholder="削除権限が必要な場合" style={{ width: '100%', padding: '10px' }} />
            </div>
            <button onClick={saveProfile} style={{ width: '100%', backgroundColor: '#5a3d8a', color: '#fff', padding: '15px', marginTop: '20px', border: 'none', borderRadius: '10px', cursor: 'pointer' }}>保存して戻る</button>
          </section>
        )}
      </main>
    </div>
  );
}
