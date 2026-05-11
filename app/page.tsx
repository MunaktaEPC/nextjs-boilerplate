"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LOGO_URL = "https://wkvetwjywdkwairqztsb.supabase.co/storage/v1/object/public/images/0.7302238554901188.png";

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
  likes?: number; // 表示用に型だけ残します
}

export default function RoboCupPortal() {
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
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState(''); 
  const [genre, setGenre] = useState('未分類');
  const [isNewGenre, setIsNewGenre] = useState(false);
  
  const bbsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const blogTextareaRef = useRef<HTMLTextAreaElement>(null);
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

  const blogArticles = useMemo(() => posts.filter(p => p.category === 'blog' && !p.parent_id), [posts]);
  const existingGenres = useMemo(() => {
    const gs = Array.from(new Set(blogArticles.map(a => a.genre || '未分類')));
    return gs.filter(g => g !== '未分類').sort();
  }, [blogArticles]);

  const mainThreads = posts.filter(p => !p.parent_id && p.category !== 'blog');
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  async function uploadFile(file: File) {
    const fileName = `${Math.random()}_${file.name}`;
    const { data, error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) return null;
    const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
    return { url: pub.publicUrl, name: file.name };
  }

  // ★ いいね処理：DBの列がないため、ローカル上でのみ動作するように修正
  async function handleLike(post: Post) {
    if (likedPosts.includes(post.id)) {
      alert("いいねは1回までです。");
      return;
    }
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
    }
    alert("保存しました");
    setView('home');
    setLoading(false);
  }

  async function handleDeletePost(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("本当に削除しますか？")) return;
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
    await supabase.from('posts').insert([{ content: replyContent, parent_id: parentId, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    setReplyContent(''); 
    await fetchData();
  }

  // ★ ブログ投稿：DBに存在しない 'likes' を削除してエラーを回避
  async function handleBlogSubmit() {
    if (!title || !content) {
      alert("タイトルと本文を入力してください");
      return;
    }
    setLoading(true);
    try {
      let imageUrl = "";
      if (imageFile) {
        const res = await uploadFile(imageFile);
        if (res) imageUrl = res.url;
      }

      const { error } = await supabase.from('posts').insert([{ 
        title, 
        content, 
        image_url: imageUrl, 
        author_name: profileName, 
        author_avatar: profileAvatar, 
        category: 'blog', 
        genre: genre || '未分類'
      }]);
      
      if (error) throw error;

      setTitle(''); setContent(''); setImageFile(null); setCoverPreview(''); setGenre('未分類');
      await fetchData();
      setView('blog_list'); 
    } catch (err) {
      alert("投稿に失敗しました。DBの列設定を確認してください。");
    } finally {
      setLoading(false);
    }
  }

  const renderContent = (text: string) => {
    const parts = text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g);
    return parts.map((part, index) => {
      const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) return <img key={index} src={imgMatch[2]} alt={imgMatch[1]} style={{ maxWidth: '100%', borderRadius: '8px', margin: '10px 0', display: 'block' }} />;
      const fileMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (fileMatch) return (
        <a key={index} href={fileMatch[2]} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#f0f0f0', padding: '8px 12px', borderRadius: '5px', textDecoration: 'none', color: '#5a3d8a', fontWeight: 'bold', margin: '5px 0' }}>
          {fileMatch[1]}
        </a>
      );
      return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', color: '#333' }}>
      
      <header style={{ backgroundColor: '#fff', borderBottom: '4px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', cursor: 'pointer' }} onClick={() => setView('home')}>
          <img src={LOGO_URL} style={{ width: '55px', height: '55px', borderRadius: '50%', border: '2px solid #5a3d8a', objectFit: 'cover' }} />
          <h1 style={{ margin: 0, color: '#5a3d8a', fontSize: '24px', fontWeight: 'bold' }}>MunakataEPC_PORTAL</h1>
        </div>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 15px', backgroundColor: '#f3eef7', borderRadius: '30px' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/35'} style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', color: '#5a3d8a' }}>{profileName} {isAdmin && '⭐'}</span>
        </div>
      </header>

      <nav style={{ padding: '15px 40px', display: 'flex', gap: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fff' }}>
        <button onClick={() => setView('home')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view === 'home' ? '#5a3d8a' : '#eee', color: view === 'home' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>🏠 ホーム</button>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('bbs') ? '#5a3d8a' : '#eee', color: view.startsWith('bbs') ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>💬 掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : '#eee', color: view.startsWith('blog') ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>🖋️ ブログ</button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px' }}>
        
        {view === 'home' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div onClick={() => setView('bbs')} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '15px', padding: '30px', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>💬</div>
              <h3>交流掲示板</h3>
            </div>
            <div onClick={() => setView('blog_list')} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '15px', padding: '30px', cursor: 'pointer', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>🖋️</div>
              <h3>活動ブログ</h3>
            </div>
          </div>
        )}

        {view === 'bbs' && (
          <div>
            <section style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', marginBottom: '40px' }}>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px' }} />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文" style={{ width: '100%', height: '80px', padding: '12px' }} />
              <button onClick={handleBbsSubmit} style={{ marginTop: '10px', backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>作成する</button>
            </section>
            {mainThreads.map(t => (
              <article key={t.id} onClick={() => { setActiveThread(t); setView('bbs_read'); }} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '15px' }}>
                <img src={t.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <h4 style={{ margin: 0, color: '#b91c1c' }}>{t.title}</h4>
                  <div style={{ fontSize: '13px', color: '#888' }}>{t.author_name} · {new Date(t.created_at).toLocaleString()}</div>
                </div>
              </article>
            ))}
          </div>
        )}

        {view === 'bbs_read' && activeThread && (
          <div>
            <button onClick={() => setView('bbs')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← 戻る</button>
            <div style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '30px', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <img src={activeThread.author_avatar || 'https://via.placeholder.com/50'} style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
                <h2 style={{ margin: 0 }}>{activeThread.title}</h2>
              </div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{renderContent(activeThread.content)}</div>
            </div>
            {getReplies(activeThread.id).map(r => (
              <div key={r.id} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee', marginBottom: '15px', display: 'flex', gap: '15px' }}>
                <img src={r.author_avatar || 'https://via.placeholder.com/35'} style={{ width: '35px', height: '35px', borderRadius: '50%' }} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{r.author_name}</div>
                  <div style={{ fontSize: '15px' }}>{renderContent(r.content)}</div>
                </div>
              </div>
            ))}
            <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信..." style={{ width: '100%', height: '80px', marginTop: '20px' }} />
            <button onClick={() => handleReplySubmit(activeThread.id)} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '10px' }}>送信</button>
          </div>
        )}

        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '30px' }}>
            <aside style={{ width: '220px' }}>
              <h3 style={{ color: '#5a3d8a' }}>📁 ジャンル</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li onClick={() => setSelectedGenre(null)} style={{ cursor: 'pointer', color: !selectedGenre ? '#b91c1c' : '#333' }}>🌐 すべて</li>
                {existingGenres.map(g => (
                  <li key={g} onClick={() => setSelectedGenre(g)} style={{ cursor: 'pointer', color: selectedGenre === g ? '#b91c1c' : '#333' }}>{g}</li>
                ))}
              </ul>
            </aside>
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2>活動ブログ</h2>
                <button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '10px 20px', borderRadius: '20px', border: 'none', cursor: 'pointer' }}>＋ 記事を書く</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                {blogArticles.filter(a => !selectedGenre || a.genre === selectedGenre).map(a => (
                  <article key={a.id} onClick={() => { setActiveArticle(a); setView('blog_read'); }} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}>
                    <div style={{ height: '150px', backgroundColor: '#eee' }}>{a.image_url && <img src={a.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                    <div style={{ padding: '15px' }}>
                      <span style={{ fontSize: '11px', backgroundColor: '#5a3d8a', color: '#fff', padding: '2px 8px', borderRadius: '10px' }}>{a.genre}</span>
                      <h4 style={{ margin: '10px 0' }}>{a.title}</h4>
                      <div style={{ fontSize: '12px', color: '#999' }}>{a.author_name}</div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'blog_read' && activeArticle && (
          <article style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '15px' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← 戻る</button>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', borderRadius: '10px', marginBottom: '20px' }} />}
            <h1>{activeArticle.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
              <img src={activeArticle.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              <div><div style={{ fontWeight: 'bold' }}>{activeArticle.author_name}</div></div>
              <button onClick={() => handleLike(activeArticle)} style={{ marginLeft: 'auto', backgroundColor: likedPosts.includes(activeArticle.id) ? '#ff4b5c' : '#fff', border: '1px solid #ff4b5c', color: likedPosts.includes(activeArticle.id) ? '#fff' : '#ff4b5c', padding: '5px 15px', borderRadius: '20px', cursor: 'pointer' }}>❤️ いいね</button>
            </div>
            <div style={{ fontSize: '18px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{renderContent(activeArticle.content)}</div>
          </article>
        )}

        {view === 'blog_write' && (
          <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>← キャンセル</button>
            <div style={{ margin: '20px 0', height: '200px', border: '2px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              {coverPreview ? <img src={coverPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span>📷 カバー画像</span>}
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setCoverPreview(URL.createObjectURL(f)); } }} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }} />
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文" style={{ width: '100%', minHeight: '300px' }} />
            <button onClick={handleBlogSubmit} disabled={loading} style={{ width: '100%', backgroundColor: '#00c58e', color: '#fff', padding: '15px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>公開する</button>
          </div>
        )}

        {view === 'profile' && (
          <section style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '15px' }}>
            <h2>プロフィール設定</h2>
            <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '10px', marginBottom: '20px' }} />
            <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} />
            <button onClick={saveProfile} style={{ width: '100%', backgroundColor: '#5a3d8a', color: '#fff', padding: '15px', borderRadius: '10px', marginTop: '20px', cursor: 'pointer' }}>保存</button>
          </section>
        )}

      </main>
    </div>
  );
}
