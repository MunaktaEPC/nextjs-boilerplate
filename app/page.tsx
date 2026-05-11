"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase接続設定
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
  
  // Refs for cursor insertion
  const bbsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const blogTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [activeThread, setActiveThread] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [activeArticle, setActiveArticle] = useState<Post | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('robocup_name');
    const savedAvatar = localStorage.getItem('robocup_avatar');
    const savedAdmin = localStorage.getItem('robocup_is_admin') === 'true';
    if (savedName) setProfileName(savedName);
    if (savedAvatar) setProfileAvatar(savedAvatar);
    if (savedAdmin) setIsAdmin(true);
    fetchData();
  }, [view]);

  async function fetchData() {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setPosts(data as Post[]);
  }

  async function uploadFile(file: File) {
    const fileName = `${Math.random()}_${file.name}`;
    const { data, error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) { alert("アップロード失敗: " + error.message); return null; }
    const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
    return { url: pub.publicUrl, name: file.name };
  }

  // ★ 修正：引数の型に | null を追加
  const insertTextAtCursor = (ref: React.RefObject<HTMLTextAreaElement | null>, text: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const textarea = ref.current;
    if (!textarea) {
      setter(prev => prev + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setter(prev => prev.substring(0, start) + text + prev.substring(end));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 10);
  };

  // ★ 修正：引数の型に | null を追加
  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>, ref: React.RefObject<HTMLTextAreaElement | null>, setter: React.Dispatch<React.SetStateAction<string>>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const res = await uploadFile(file);
    if (res) {
      const isImage = file.type.startsWith('image/');
      const tag = isImage ? `\n![${res.name}](${res.url})\n` : `\n[📎 添付ファイル: ${res.name}](${res.url})\n`;
      insertTextAtCursor(ref, tag, setter);
    }
    setIsUploading(false);
    e.target.value = '';
  }

  async function saveProfile() {
    setLoading(true);
    let newAvatarUrl = profileAvatar;
    if (avatarFile) {
      const res = await uploadFile(avatarFile);
      if (res) { newAvatarUrl = res.url; setProfileAvatar(newAvatarUrl); }
    }
    localStorage.setItem('robocup_name', profileName);
    localStorage.setItem('robocup_avatar', newAvatarUrl);
    if (adminPassInput === 'admin1234') {
      localStorage.setItem('robocup_is_admin', 'true');
      setIsAdmin(true);
      alert("管理者モード有効");
    }
    setAvatarFile(null); setAvatarPreview(''); setAdminPassInput('');
    alert("保存しました");
    setView('home');
    setLoading(false);
  }

  async function handleDeletePost(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("削除しますか？")) return;
    setLoading(true);
    await supabase.from('posts').delete().eq('id', id);
    await supabase.from('posts').delete().eq('parent_id', id);
    if (activeThread?.id === id) setView('bbs');
    if (activeArticle?.id === id) setView('blog_list');
    fetchData();
    setLoading(false);
  }

  async function handleBbsSubmit() {
    if (!title || !content) return;
    setLoading(true);
    await supabase.from('posts').insert([{ 
      title, content, author_name: profileName, author_avatar: profileAvatar, category: 'bbs'
    }]);
    setTitle(''); setContent(''); fetchData(); setLoading(false);
  }

  async function handleReplySubmit() {
    if (!replyContent || !activeThread) return;
    setLoading(true);
    await supabase.from('posts').insert([{ 
      content: replyContent, parent_id: activeThread.id, author_name: profileName, author_avatar: profileAvatar, category: 'bbs'
    }]);
    setReplyContent(''); fetchData(); setLoading(false);
  }

  async function handleBlogSubmit() {
    if (!title || !content) return;
    setLoading(true);
    let imageUrl = imageFile ? (await uploadFile(imageFile))?.url : '';
    await supabase.from('posts').insert([{ 
      title, content, image_url: imageUrl, author_name: profileName, author_avatar: profileAvatar, category: 'blog', genre: genre || '未分類'
    }]);
    setTitle(''); setContent(''); setImageFile(null); setCoverPreview(''); setGenre('未分類');
    setView('blog_list'); fetchData(); setLoading(false);
  }

  const mainThreads = posts.filter(p => !p.parent_id);
  const bbsThreads = mainThreads.filter(p => p.category !== 'blog');
  const blogArticles = mainThreads.filter(p => p.category === 'blog');
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).reverse();

  const renderContent = (text: string) => {
    const parts = text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g);
    return parts.map((part, index) => {
      const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) return <img key={index} src={imgMatch[2]} alt={imgMatch[1]} style={{ maxWidth: '100%', borderRadius: '8px', margin: '15px 0', display: 'block' }} />;
      const fileMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (fileMatch) return (
        <a key={index} href={fileMatch[2]} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#f0f0f0', padding: '10px 15px', borderRadius: '8px', border: '1px solid #ccc', textDecoration: 'none', color: '#5a3d8a', fontWeight: 'bold', margin: '10px 0' }}>
          {fileMatch[1]}
        </a>
      );
      return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fdfdfd', color: '#333', fontFamily: 'sans-serif' }}>
      
      <header style={{ backgroundColor: '#fff', borderBottom: '4px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', cursor: 'pointer' }} onClick={() => setView('home')}>
          <img src={LOGO_URL} style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid #5a3d8a', objectFit: 'cover' }} />
          <div>
            <h1 style={{ margin: 0, color: '#5a3d8a', fontSize: '24px', fontWeight: 'bold' }}>ロボカップ情報共有</h1>
            <span style={{ fontSize: '12px', color: '#666' }}>〜 公式ポータル 〜</span>
          </div>
        </div>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 15px', backgroundColor: isAdmin ? '#ffebee' : '#f3eef7', borderRadius: '30px' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/35?text=👤'} style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', color: isAdmin ? '#c62828' : '#5a3d8a' }}>{profileName}</span>
          <span>⚙️</span>
        </div>
      </header>

      <nav style={{ padding: '15px 40px', display: 'flex', gap: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fff' }}>
        <button onClick={() => setView('home')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view === 'home' ? '#5a3d8a' : '#eee', color: view === 'home' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>🏠 ホーム</button>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('bbs') ? '#5a3d8a' : '#eee', color: view.startsWith('bbs') ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>💬 掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : '#eee', color: view.startsWith('blog') ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>🖋️ ブログ</button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px' }}>
        
        {view === 'home' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '40px', padding: '50px 20px', backgroundColor: '#f8f5fb', borderRadius: '20px', border: '1px solid #dcd0ea' }}>
              <h2 style={{ color: '#5a3d8a', fontSize: '30px', marginBottom: '10px' }}>ロボカップ情報共有へようこそ</h2>
              <p style={{ color: '#666' }}>開発情報、技術記事、大会の相談などを共有しましょう。</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div onClick={() => setView('bbs')} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '15px', padding: '30px', cursor: 'pointer', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>💬</div>
                <h3>交流掲示板</h3>
                <p style={{ color: '#666', fontSize: '14px' }}>クイックな相談、連絡、雑談はこちらから。</p>
              </div>
              <div onClick={() => setView('blog_list')} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '15px', padding: '30px', cursor: 'pointer', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>🖋️</div>
                <h3>技術ブログ</h3>
                <p style={{ color: '#666', fontSize: '14px' }}>回路図やプログラムの解説、制作記録に。</p>
              </div>
              <div style={{ backgroundColor: '#f9f9f9', border: '1px dashed #ccc', borderRadius: '15px', padding: '30px', textAlign: 'center', opacity: 0.6 }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>📅</div>
                <h3 style={{ color: '#888' }}>予定表 (準備中)</h3>
              </div>
              <div style={{ backgroundColor: '#f9f9f9', border: '1px dashed #ccc', borderRadius: '15px', padding: '30px', textAlign: 'center', opacity: 0.6 }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>📷</div>
                <h3 style={{ color: '#888' }}>ギャラリー (準備中)</h3>
              </div>
            </div>
          </div>
        )}

        {view === 'bbs' && (
          <div>
            <section style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', border: '1px solid #dcd0ea', marginBottom: '30px' }}>
              <h2 style={{ fontSize: '18px', color: '#5a3d8a', marginTop: 0 }}>💬 新しいスレッド</h2>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <textarea ref={bbsTextareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文を入力..." style={{ width: '100%', height: '100px', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ cursor: 'pointer', color: '#5a3d8a', fontSize: '14px', fontWeight: 'bold' }}>
                  {isUploading ? '⏳ アップロード中...' : '📎 画像/ファイルを本文に挿入'}
                  <input type="file" onChange={(e) => handleFileAttach(e, bbsTextareaRef, setContent)} style={{ display: 'none' }} />
                </label>
                <button onClick={handleBbsSubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>投稿する</button>
              </div>
            </section>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {bbsThreads.map(thread => (
                <article key={thread.id} onClick={() => { setActiveThread(thread); setView('bbs_read'); }} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, color: '#b91c1c' }}>{thread.title}</h3>
                    {isAdmin && <button onClick={(e) => handleDeletePost(thread.id, e)} style={{ border: 'none', background: 'none', color: '#c62828' }}>🗑️</button>}
                  </div>
                  <div style={{ color: '#666', fontSize: '13px', marginTop: '10px' }}>{thread.author_name} · {new Date(thread.created_at).toLocaleString('ja-JP')} · 返信 {getReplies(thread.id).length}件</div>
                </article>
              ))}
            </div>
          </div>
        )}

        {view === 'bbs_read' && activeThread && (
          <div>
            <button onClick={() => setView('bbs')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '15px' }}>← 戻る</button>
            <article style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' }}>
              <div style={{ backgroundColor: '#f8f5fb', padding: '20px', borderBottom: '1px solid #eee' }}>
                <h2 style={{ color: '#b91c1c', margin: 0 }}>{activeThread.title}</h2>
                <div style={{ fontSize: '14px', color: '#555', marginTop: '5px' }}>{activeThread.author_name} · {new Date(activeThread.created_at).toLocaleString('ja-JP')}</div>
              </div>
              <div style={{ padding: '30px', lineHeight: '1.8' }}>{renderContent(activeThread.content)}</div>
            </article>

            {getReplies(activeThread.id).map(reply => (
              <div key={reply.id} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #eee', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{reply.author_name}</span>
                  {isAdmin && <button onClick={() => handleDeletePost(reply.id)} style={{ border: 'none', background: 'none', color: '#c62828' }}>🗑️</button>}
                </div>
                <div>{renderContent(reply.content)}</div>
              </div>
            ))}

            <div style={{ marginTop: '20px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '12px', border: '1px solid #ddd' }}>
              <textarea ref={replyTextareaRef} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信を書く..." style={{ width: '100%', height: '80px', padding: '15px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '10px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ cursor: 'pointer', color: '#5a3d8a', fontSize: '14px' }}>
                  📎 ファイル添付
                  <input type="file" onChange={(e) => handleFileAttach(e, replyTextareaRef, setReplyContent)} style={{ display: 'none' }} />
                </label>
                <button onClick={handleReplySubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>返信する</button>
              </div>
            </div>
          </div>
        )}

        {view === 'blog_list' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <h2 style={{ margin: 0 }}>技術ブログ</h2>
              <button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '10px 25px', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer' }}>＋ 記事を書く</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
              {blogArticles.map(article => (
                <article key={article.id} onClick={() => { setActiveArticle(article); setView('blog_read'); }} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div style={{ height: '160px', backgroundColor: '#f0f0f0' }}>{article.image_url && <img src={article.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                  <div style={{ padding: '15px' }}>
                    <div style={{ fontSize: '12px', color: '#fff', backgroundColor: '#5a3d8a', display: 'inline-block', padding: '2px 8px', borderRadius: '5px' }}>{article.genre}</div>
                    <h3 style={{ margin: '10px 0' }}>{article.title}</h3>
                    <div style={{ fontSize: '12px', color: '#999' }}>{article.author_name} · {new Date(article.created_at).toLocaleDateString()}</div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {view === 'blog_write' && (
          <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← 戻る</button>
            <div style={{ marginBottom: '20px', background: '#f9f9f9', border: '1px dashed #ccc', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
              {coverPreview ? <img src={coverPreview} style={{ width: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#888' }}>📷 カバー画像を選択</span>}
              <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setImageFile(file); setCoverPreview(URL.createObjectURL(file)); } }} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </div>
            <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="ジャンル (例: board/main)" style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #ccc' }} />
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', fontSize: '28px', fontWeight: 'bold', border: 'none', borderBottom: '1px solid #eee', marginBottom: '20px', outline: 'none' }} />
            <div style={{ marginBottom: '10px' }}>
              <label style={{ cursor: 'pointer', fontSize: '14px', background: '#f0f0f0', padding: '5px 15px', borderRadius: '5px', border: '1px solid #ccc' }}>
                {isUploading ? 'アップロード中...' : '📎 画像/ファイルを本文に挿入'}
                <input type="file" onChange={(e) => handleFileAttach(e, blogTextareaRef, setContent)} style={{ display: 'none' }} />
              </label>
            </div>
            <textarea ref={blogTextareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文を入力..." style={{ width: '100%', minHeight: '400px', fontSize: '18px', border: 'none', outline: 'none', lineHeight: '1.8' }} />
            <button onClick={handleBlogSubmit} disabled={loading} style={{ width: '100%', backgroundColor: '#00c58e', color: '#fff', padding: '15px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>公開する</button>
          </div>
        )}

        {view === 'blog_read' && activeArticle && (
          <article style={{ maxWidth: '800px', margin: '0 auto' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← 一覧へ</button>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '12px', marginBottom: '20px' }} />}
            <div style={{ fontSize: '14px', color: '#5a3d8a', fontWeight: 'bold' }}>📁 {activeArticle.genre}</div>
            <h1 style={{ fontSize: '32px', margin: '10px 0' }}>{activeArticle.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '30px', paddingBottom: '20px', borderBottom: '1px solid #eee' }}>
              <img src={activeArticle.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
              <div>
                <div style={{ fontWeight: 'bold' }}>{activeArticle.author_name}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>{new Date(activeArticle.created_at).toLocaleString('ja-JP')}</div>
              </div>
              {isAdmin && <button onClick={() => handleDeletePost(activeArticle.id)} style={{ marginLeft: 'auto', color: '#c62828', border: 'none', background: 'none' }}>🗑️</button>}
            </div>
            <div style={{ fontSize: '18px', lineHeight: '2.0' }}>{renderContent(activeArticle.content)}</div>
          </article>
        )}

        {view === 'profile' && (
          <section style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd' }}>
            <h2 style={{ color: '#5a3d8a', marginTop: 0 }}>⚙️ プロフィール設定</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>表示名</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div style={{ marginBottom: '30px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>アイコン</label>
              <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); } }} />
              {(avatarPreview || profileAvatar) && <img src={avatarPreview || profileAvatar} style={{ width: '80px', height: '80px', borderRadius: '50%', marginTop: '15px', objectFit: 'cover' }} />}
            </div>
            <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px dashed #ccc' }}>
              <label style={{ fontSize: '13px', color: '#666' }}>🔑 管理者用パスワード (admin1234)</label>
              <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '5px' }} />
            </div>
            <button onClick={saveProfile} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 40px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>保存する</button>
          </section>
        )}

      </main>
    </div>
  );
}
