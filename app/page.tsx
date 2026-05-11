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

export default function RoboCupPortal() {
  const [view, setView] = useState<'home' | 'bbs' | 'bbs_read' | 'blog_list' | 'blog_write' | 'blog_read' | 'profile'>('home');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  
  // プロフィール設定
  const [profileName, setProfileName] = useState('名無しさん');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');

  // 投稿用ステート
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

  // ブログ関連の計算
  const blogArticles = useMemo(() => posts.filter(p => p.category === 'blog' && !p.parent_id), [posts]);
  const existingGenres = useMemo(() => {
    const gs = Array.from(new Set(blogArticles.map(a => a.genre || '未分類')));
    return gs.filter(g => g !== '未分類').sort();
  }, [blogArticles]);

  // 掲示板関連の計算
  const mainThreads = posts.filter(p => !p.parent_id && p.category !== 'blog');
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  async function uploadFile(file: File) {
    const fileName = `${Math.random()}_${file.name}`;
    const { data, error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) return null;
    const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
    return { url: pub.publicUrl, name: file.name };
  }

  // いいね処理（1人1回）
  async function handleLike(post: Post) {
    if (likedPosts.includes(post.id)) {
      alert("いいねは1回までです。");
      return;
    }
    const newLikes = (post.likes || 0) + 1;
    const newLikedList = [...likedPosts, post.id];
    setLikedPosts(newLikedList);
    localStorage.setItem('robocup_liked_ids', JSON.stringify(newLikedList));
    
    // UIを即時更新
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));
    if (activeArticle?.id === post.id) setActiveArticle({ ...activeArticle, likes: newLikes });

    await supabase.from('posts').update({ likes: newLikes }).eq('id', post.id);
  }

  // プロフィール保存
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

  // 記事・スレッド削除
  async function handleDeletePost(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("本当に削除しますか？")) return;
    await supabase.from('posts').delete().eq('id', id);
    await supabase.from('posts').delete().eq('parent_id', id);
    if (activeThread?.id === id) setView('bbs');
    if (activeArticle?.id === id) setView('blog_list');
    await fetchData();
  }

  // 掲示板投稿
  async function handleBbsSubmit() {
    if (!title || !content) return;
    setLoading(true);
    await supabase.from('posts').insert([{ 
      title, content, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' 
    }]);
    setTitle(''); setContent('');
    await fetchData();
    setView('bbs');
    setLoading(false);
  }

  // 掲示板返信
  async function handleReplySubmit(parentId: string) {
    if (!replyContent) return;
    await supabase.from('posts').insert([{ 
      content: replyContent, parent_id: parentId, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' 
    }]);
    setReplyContent(''); 
    await fetchData();
  }

  // ブログ投稿
  async function handleBlogSubmit() {
    if (!title || !content) return;
    setLoading(true);
    let imageUrl = imageFile ? (await uploadFile(imageFile))?.url : '';
    const { error } = await supabase.from('posts').insert([{ 
      title, content, image_url: imageUrl, author_name: profileName, author_avatar: profileAvatar, category: 'blog', genre: genre || '未分類', likes: 0 
    }]);
    
    if (!error) {
      setTitle(''); setContent(''); setImageFile(null); setCoverPreview(''); setGenre('未分類');
      await fetchData();
      setView('blog_list'); 
    } else {
      alert("投稿に失敗しました。");
    }
    setLoading(false);
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', color: '#333', fontFamily: 'sans-serif' }}>
      
      {/* ヘッダー */}
      <header style={{ backgroundColor: '#fff', borderBottom: '3px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 onClick={() => setView('home')} style={{ margin: 0, fontSize: '20px', color: '#5a3d8a', cursor: 'pointer', fontWeight: '900' }}>ロボカップ情報共有</h1>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 15px', backgroundColor: '#f3eef7', borderRadius: '30px' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/30'} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{profileName}{isAdmin && ' (Admin)'}</span>
        </div>
      </header>

      {/* ナビゲーション */}
      <nav style={{ padding: '10px 40px', display: 'flex', gap: '10px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
        <button onClick={() => setView('home')} style={{ padding: '8px 20px', border: 'none', borderRadius: '5px', backgroundColor: view === 'home' ? '#5a3d8a' : 'transparent', color: view === 'home' ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>🏠 Home</button>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 20px', border: 'none', borderRadius: '5px', backgroundColor: view.startsWith('bbs') ? '#5a3d8a' : 'transparent', color: view.startsWith('bbs') ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>💬 掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '8px 20px', border: 'none', borderRadius: '5px', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : 'transparent', color: view.startsWith('blog') ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>🖋️ ブログ</button>
      </nav>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' }}>
        
        {/* ホーム画面 */}
        {view === 'home' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div onClick={() => setView('bbs')} style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', textAlign: 'center', cursor: 'pointer', border: '1px solid #eee' }}>
              <div style={{ fontSize: '40px', marginBottom: '15px' }}>💬</div>
              <h3 style={{ margin: 0 }}>交流掲示板</h3>
            </div>
            <div onClick={() => setView('blog_list')} style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', textAlign: 'center', cursor: 'pointer', border: '1px solid #eee' }}>
              <div style={{ fontSize: '40px', marginBottom: '15px' }}>🖋️</div>
              <h3 style={{ margin: 0 }}>技術ブログ</h3>
            </div>
          </div>
        )}

        {/* 掲示板一覧 */}
        {view === 'bbs' && (
          <div>
            <div style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', marginBottom: '30px' }}>
              <h3 style={{ marginTop: 0, color: '#5a3d8a' }}>新規スレッド作成</h3>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <textarea ref={bbsTextareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文を入力..." style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <button onClick={handleBbsSubmit} style={{ marginTop: '10px', backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>投稿する</button>
            </div>
            {mainThreads.map(t => (
              <article key={t.id} onClick={() => { setActiveThread(t); setView('bbs_read'); }} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '12px', marginBottom: '15px', cursor: 'pointer', border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <img src={t.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ flexGrow: 1 }}>
                  <h4 style={{ margin: '0 0 5px 0', color: '#d32f2f', fontSize: '18px' }}>{t.title}</h4>
                  <div style={{ fontSize: '13px', color: '#888' }}>{t.author_name} · {new Date(t.created_at).toLocaleString()}</div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* 掲示板スレッド詳細 */}
        {view === 'bbs_read' && activeThread && (
          <div>
            <button onClick={() => setView('bbs')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← 戻る</button>
            <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '15px', border: '1px solid #ddd', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                <img src={activeThread.author_avatar || 'https://via.placeholder.com/50'} style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
                <div>
                  <h2 style={{ margin: 0, color: '#d32f2f' }}>{activeThread.title}</h2>
                  <div style={{ fontSize: '13px', color: '#888' }}>{activeThread.author_name} · {new Date(activeThread.created_at).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ fontSize: '16px', lineHeight: '1.8' }}>{renderContent(activeThread.content)}</div>
            </div>

            <div style={{ marginBottom: '40px' }}>
              {getReplies(activeThread.id).map(r => (
                <div key={r.id} style={{ display: 'flex', gap: '15px', marginBottom: '20px', padding: '15px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #eee' }}>
                  <img src={r.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                  <div style={{ flexGrow: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>{r.author_name} <span style={{ fontWeight: 'normal', color: '#aaa', fontSize: '11px' }}>{new Date(r.created_at).toLocaleString()}</span></div>
                    <div style={{ fontSize: '15px' }}>{renderContent(r.content)}</div>
                  </div>
                  {isAdmin && <button onClick={() => handleDeletePost(r.id)} style={{ border: 'none', background: 'none', color: '#ddd', cursor: 'pointer' }}>🗑️</button>}
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', border: '1px solid #ddd' }}>
              <textarea ref={replyTextareaRef} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信を書く..." style={{ width: '100%', height: '80px', padding: '15px', borderRadius: '10px', border: '1px solid #eee' }} />
              <button onClick={() => handleReplySubmit(activeThread.id)} style={{ marginTop: '10px', backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>返信する</button>
            </div>
          </div>
        )}

        {/* ブログ一覧 */}
        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '30px' }}>
            <aside style={{ width: '220px', flexShrink: 0 }}>
              <h3 style={{ color: '#5a3d8a', borderBottom: '2px solid #5a3d8a', paddingBottom: '10px' }}>📁 ジャンル</h3>
              <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px' }}>
                <li onClick={() => setSelectedGenre(null)} style={{ cursor: 'pointer', color: !selectedGenre ? '#d32f2f' : '#555', marginBottom: '12px', fontWeight: !selectedGenre ? 'bold' : 'normal' }}>すべて表示</li>
                {existingGenres.map(g => (
                  <li key={g} onClick={() => setSelectedGenre(g)} style={{ cursor: 'pointer', color: selectedGenre === g ? '#d32f2f' : '#555', marginBottom: '12px', fontWeight: selectedGenre === g ? 'bold' : 'normal' }}>{g}</li>
                ))}
              </ul>
            </aside>
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h2 style={{ margin: 0 }}>技術ブログ</h2>
                <button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '12px 25px', borderRadius: '30px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>＋ 記事を書く</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
                {blogArticles.filter(a => !selectedGenre || a.genre === selectedGenre).map(a => (
                  <article key={a.id} onClick={() => { setActiveArticle(a); setView('blog_read'); }} style={{ backgroundColor: '#fff', borderRadius: '15px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #eee', transition: 'transform 0.2s' }}>
                    <div style={{ height: '150px', backgroundColor: '#eee' }}>{a.image_url && <img src={a.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                    <div style={{ padding: '18px' }}>
                      <span style={{ fontSize: '11px', backgroundColor: '#5a3d8a', color: '#fff', padding: '3px 8px', borderRadius: '4px' }}>{a.genre}</span>
                      <h4 style={{ margin: '12px 0', fontSize: '18px', lineHeight: '1.4' }}>{a.title}</h4>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#999' }}>
                        <span>{a.author_name}</span>
                        <span>❤️ {a.likes || 0}</span>
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
          <article style={{ maxWidth: '850px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '20px', overflow: 'hidden', border: '1px solid #eee' }}>
            <div style={{ height: '350px', backgroundColor: '#eee' }}>{activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
            <div style={{ padding: '40px' }}>
              <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← 一覧に戻る</button>
              <div style={{ fontSize: '14px', color: '#5a3d8a', fontWeight: 'bold', marginBottom: '10px' }}>📁 {activeArticle.genre}</div>
              <h1 style={{ fontSize: '36px', margin: '0 0 25px 0', lineHeight: '1.3' }}>{activeArticle.title}</h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', paddingBottom: '25px', borderBottom: '1px solid #eee' }}>
                <img src={activeArticle.author_avatar || 'https://via.placeholder.com/45'} style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>{activeArticle.author_name}</div>
                  <div style={{ fontSize: '12px', color: '#888' }}>{new Date(activeArticle.created_at).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleLike(activeArticle)} style={{ backgroundColor: likedPosts.includes(activeArticle.id) ? '#ff4b5c' : '#fff', border: '1px solid #ff4b5c', color: likedPosts.includes(activeArticle.id) ? '#fff' : '#ff4b5c', padding: '10px 25px', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold' }}>❤️ {activeArticle.likes || 0}</button>
                  {isAdmin && <button onClick={() => handleDeletePost(activeArticle.id)} style={{ border: '1px solid #d32f2f', color: '#d32f2f', background: 'none', padding: '10px 15px', borderRadius: '30px', cursor: 'pointer' }}>🗑️ 削除</button>}
                </div>
              </div>
              <div style={{ fontSize: '18px', lineHeight: '1.9' }}>{renderContent(activeArticle.content)}</div>
            </div>
          </article>
        )}

        {/* ブログ執筆 */}
        {view === 'blog_write' && (
          <div style={{ maxWidth: '850px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '20px', border: '1px solid #ddd' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← キャンセル</button>
            <div style={{ marginBottom: '30px', height: '250px', border: '2px dashed #ddd', borderRadius: '15px', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
              {coverPreview ? <img src={coverPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#888' }}>📷 カバー画像を選択（クリック）</span>}
              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImageFile(f); setCoverPreview(URL.createObjectURL(f)); } }} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </div>
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>📁 ジャンル</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {!isNewGenre ? (
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }}>
                    <option value="未分類">未分類</option>{existingGenres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="新規ジャンルを入力" onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
                )}
                <button onClick={() => setIsNewGenre(!isNewGenre)} style={{ padding: '0 15px', borderRadius: '8px', border: '1px solid #ccc', background: '#f9f9f9', cursor: 'pointer' }}>{isNewGenre ? '選択に戻る' : '新規作成'}</button>
              </div>
            </div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトルを入力..." style={{ width: '100%', fontSize: '30px', fontWeight: 'bold', border: 'none', borderBottom: '2px solid #eee', marginBottom: '30px', padding: '10px 0', outline: 'none' }} />
            <textarea ref={blogTextareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文を入力..." style={{ width: '100%', minHeight: '400px', border: 'none', outline: 'none', fontSize: '18px', lineHeight: '1.6' }} />
            <button onClick={handleBlogSubmit} disabled={loading} style={{ width: '100%', backgroundColor: '#00c58e', color: '#fff', padding: '18px', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', marginTop: '30px' }}>{loading ? "投稿中..." : "記事を公開する"}</button>
          </div>
        )}

        {/* プロフィール設定 */}
        {view === 'profile' && (
          <section style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '20px', border: '1px solid #ddd' }}>
            <h2 style={{ color: '#5a3d8a', marginBottom: '30px' }}>ユーザー設定</h2>
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>表示名</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>プロフィールアイコン</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <img src={avatarPreview || 'https://via.placeholder.com/60'} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #eee' }} />
                <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } }} />
              </div>
            </div>
            <div style={{ padding: '20px', backgroundColor: '#fff5f5', borderRadius: '12px', marginBottom: '30px', border: '1px solid #ffebeb' }}>
              <label style={{ fontSize: '12px', color: '#d32f2f', fontWeight: 'bold' }}>🔑 管理者用パスワード</label>
              <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '5px', border: '1px solid #ffcccc' }} />
            </div>
            <button onClick={saveProfile} style={{ width: '100%', backgroundColor: '#5a3d8a', color: '#fff', padding: '15px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>設定を保存する</button>
          </section>
        )}

      </main>
    </div>
  );
}
