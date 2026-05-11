"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase接続設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// TypeScript用 型定義
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
  
  // プロフィール＆管理者用
  const [profileName, setProfileName] = useState('名無しさん');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');

  // 入力用
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState(''); 
  const [genre, setGenre] = useState('未分類');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // 掲示板・ブログ閲覧用
  const [activeThread, setActiveThread] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [activeArticle, setActiveArticle] = useState<Post | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('munakata_name');
    const savedAvatar = localStorage.getItem('munakata_avatar');
    const savedAdmin = localStorage.getItem('munakata_is_admin') === 'true';
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

  // ファイル/画像アップロード共通
  async function uploadToStorage(file: File) {
    const fileName = `${Math.random()}_${file.name}`;
    const { data } = await supabase.storage.from('images').upload(fileName, file);
    if (data) {
      const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
      return { url: pub.publicUrl, name: file.name };
    }
    return null;
  }

  async function saveProfile() {
    setLoading(true);
    let newAvatarUrl = profileAvatar;
    if (avatarFile) {
      const res = await uploadToStorage(avatarFile);
      if (res) {
        newAvatarUrl = res.url;
        setProfileAvatar(newAvatarUrl);
      }
    }
    localStorage.setItem('munakata_name', profileName);
    localStorage.setItem('munakata_avatar', newAvatarUrl);
    
    if (adminPassInput === 'admin1234') {
      localStorage.setItem('munakata_is_admin', 'true');
      setIsAdmin(true);
      alert("管理者モードが有効になりました！");
    }

    setAvatarFile(null); setAvatarPreview(''); setAdminPassInput('');
    alert("プロフィールを保存しました！");
    setView('home');
    setLoading(false);
  }

  // 汎用ファイル添付機能
  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    const res = await uploadToStorage(file);
    if (res) {
      // 閲覧画面の最後に追加されるようにする
      const fileLink = `\n\n[📎 添付ファイル: ${res.name}](${res.url})`;
      if (view === 'bbs_read') {
        setReplyContent(prev => prev + fileLink);
      } else {
        setContent(prev => prev + fileLink);
      }
      alert(`${res.name} を添付しました！`);
    }
    setUploadingFile(false);
    e.target.value = '';
  }

  async function handleDeletePost(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("本当にこの投稿を削除しますか？")) return;
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
    let imageUrl = imageFile ? (await uploadToStorage(imageFile))?.url : '';
    await supabase.from('posts').insert([{ 
      title, content, image_url: imageUrl, author_name: profileName, author_avatar: profileAvatar, category: 'bbs'
    }]);
    setTitle(''); setContent(''); setImageFile(null);
    fetchData(); setLoading(false);
  }

  // ★ 欠落していた返信送信関数
  async function handleReplySubmit() {
    if (!replyContent || !activeThread) return;
    setLoading(true);
    await supabase.from('posts').insert([{ 
      content: replyContent, parent_id: activeThread.id, author_name: profileName, author_avatar: profileAvatar, category: 'bbs'
    }]);
    setReplyContent('');
    fetchData(); setLoading(false);
  }

  async function handleBlogSubmit() {
    if (!title || !content) { alert("タイトルと本文は必須です！"); return; }
    setLoading(true);
    let imageUrl = imageFile ? (await uploadToStorage(imageFile))?.url : '';
    const finalGenre = genre.trim() === '' ? '未分類' : genre.trim();
    
    await supabase.from('posts').insert([{ 
      title, content, image_url: imageUrl, author_name: profileName, author_avatar: profileAvatar, category: 'blog',
      genre: finalGenre
    }]);
    setTitle(''); setContent(''); setImageFile(null); setCoverPreview(''); setGenre('未分類');
    alert("記事を公開しました！");
    setView('blog_list'); fetchData(); setLoading(false);
  }

  const mainThreads = posts.filter(p => !p.parent_id);
  const bbsThreads = mainThreads.filter(p => p.category !== 'blog');
  const blogArticles = mainThreads.filter(p => p.category === 'blog');
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).reverse();

  const dynamicGenres = useMemo(() => {
    const genreSet = new Set<string>();
    blogArticles.forEach(article => {
      if (article.genre && article.genre !== '未分類') {
        const parts = article.genre.split('/');
        let currentPath = '';
        parts.forEach((part: string) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          genreSet.add(currentPath);
        });
      }
    });
    const sortedPaths = Array.from(genreSet).sort();
    return [
      { id: '未分類', label: '未分類', level: 0 },
      ...sortedPaths.map((path: string) => {
        const parts = path.split('/');
        return { id: path, label: parts[parts.length - 1], level: parts.length - 1 };
      })
    ];
  }, [blogArticles]);

  const renderContent = (text: string) => {
    const parts = text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g);
    return parts.map((part: string, index: number) => {
      const imgMatch = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (imgMatch) {
        return <img key={index} src={imgMatch[2]} alt={imgMatch[1]} style={{ maxWidth: '100%', borderRadius: '8px', margin: '15px 0', display: 'block' }} />;
      }
      const fileMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (fileMatch) {
        return (
          <a key={index} href={fileMatch[2]} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', backgroundColor: '#f0f0f0', padding: '10px 15px', borderRadius: '8px', border: '1px solid #ccc', textDecoration: 'none', color: '#5a3d8a', fontWeight: 'bold', margin: '10px 0' }}>
            {fileMatch[1]}
          </a>
        );
      }
      return <span key={index} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fdfdfd', color: '#333' }}>
      
      <header style={{ backgroundColor: '#fff', borderBottom: '4px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ cursor: 'pointer' }} onClick={() => setView('home')}>
          <h1 style={{ margin: 0, color: '#5a3d8a', fontSize: '26px', fontWeight: 'bold' }}>ロボカップ情報共有</h1>
          <span style={{ fontSize: '13px', color: '#666' }}>〜 交流サイト 〜</span>
        </div>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 15px', backgroundColor: isAdmin ? '#ffebee' : '#f3eef7', borderRadius: '30px', border: `1px solid ${isAdmin ? '#ef9a9a' : '#dcd0ea'}` }}>
          <img src={profileAvatar || 'https://via.placeholder.com/35?text=Img'} style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', color: isAdmin ? '#c62828' : '#5a3d8a' }}>{profileName} {isAdmin && '⭐'}</span>
          <span>⚙️</span>
        </div>
      </header>

      <nav style={{ padding: '15px 40px', display: 'flex', gap: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fff', overflowX: 'auto' }}>
        <button onClick={() => setView('home')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view === 'home' ? '#5a3d8a' : '#eee', color: view === 'home' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🏠 ホーム</button>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('bbs') ? '#5a3d8a' : '#eee', color: view.startsWith('bbs') ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>💬 掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : '#eee', color: view.startsWith('blog') ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🖋️ ブログ</button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px' }}>
        
        {view === 'home' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '40px', padding: '40px 20px', backgroundColor: '#f8f5fb', borderRadius: '15px', border: '1px solid #dcd0ea' }}>
              <h2 style={{ color: '#5a3d8a', fontSize: '28px', margin: '0 0 10px 0' }}>ロボカップ情報共有へようこそ</h2>
              <p style={{ color: '#555', margin: 0 }}>部員同士で情報を自由に共有しましょう。</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div onClick={() => setView('bbs')} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '15px', padding: '30px', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>💬</div>
                <h3 style={{ color: '#333', margin: '0 0 10px 0' }}>交流掲示板</h3>
                <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>クイックな相談や連絡に。</p>
              </div>
              <div onClick={() => setView('blog_list')} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '15px', padding: '30px', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>🖋️</div>
                <h3 style={{ color: '#333', margin: '0 0 10px 0' }}>技術ブログ</h3>
                <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>制作記録や解説記事に。</p>
              </div>
            </div>
          </div>
        )}

        {view === 'profile' && (
          <section style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd' }}>
            <h2 style={{ color: '#5a3d8a', marginTop: 0 }}>⚙️ プロフィール設定</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>表示名</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div style={{ marginBottom: '30px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>アイコン画像</label>
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); }
              }} />
              {(avatarPreview || profileAvatar) && (
                <img src={avatarPreview || profileAvatar} style={{ width: '70px', height: '70px', borderRadius: '50%', marginTop: '15px', display: 'block', objectFit: 'cover' }} />
              )}
            </div>
            {!isAdmin && (
              <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px dashed #ccc' }}>
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '5px' }}>🔑 管理者パスワード</label>
                <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} placeholder="合言葉を入力" style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} />
              </div>
            )}
            <button onClick={saveProfile} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 40px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>保存する</button>
          </section>
        )}

        {view === 'bbs' && (
          <div>
            <section style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', border: '1px solid #dcd0ea', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', color: '#5a3d8a', marginTop: 0 }}>💬 新しいスレッド</h2>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文を入力..." style={{ width: '100%', height: '80px', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <label style={{ cursor: 'pointer', fontSize: '13px', backgroundColor: '#fff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc' }}>
                  📎 添付
                  <input type="file" onChange={handleAttachFile} style={{ display: 'none' }} disabled={uploadingFile} />
                </label>
                <button onClick={handleBbsSubmit} disabled={loading} style={{ marginLeft: 'auto', backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>投稿する</button>
              </div>
            </section>
            <div style={{ display: 'grid', gap: '15px' }}>
              {bbsThreads.map(thread => (
                <article key={thread.id} onClick={() => { setActiveThread(thread); setView('bbs_read'); }} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '20px', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, color: '#b91c1c' }}>{thread.title}</h3>
                    {isAdmin && <button onClick={(e) => handleDeletePost(thread.id, e)} style={{ border: 'none', background: 'none', color: '#c62828', cursor: 'pointer' }}>🗑️</button>}
                  </div>
                  <div style={{ color: '#666', fontSize: '13px', marginTop: '10px' }}>{thread.author_name} · {new Date(thread.created_at).toLocaleString('ja-JP')} · 返信 {getReplies(thread.id).length}件</div>
                </article>
              ))}
            </div>
          </div>
        )}

        {view === 'bbs_read' && activeThread && (
          <div>
            <button onClick={() => setView('bbs')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← 戻る</button>
            <article style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '30px', marginBottom: '30px' }}>
              <h2 style={{ color: '#b91c1c', marginTop: 0 }}>{activeThread.title}</h2>
              <div style={{ marginBottom: '20px', fontSize: '14px', color: '#666' }}>{activeThread.author_name} - {new Date(activeThread.created_at).toLocaleString('ja-JP')}</div>
              <div>{renderContent(activeThread.content)}</div>
            </article>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
              {getReplies(activeThread.id).map(reply => (
                <div key={reply.id} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{reply.author_name}</span>
                    {isAdmin && <button onClick={() => handleDeletePost(reply.id)} style={{ border: 'none', background: 'none', color: '#c62828' }}>🗑️</button>}
                  </div>
                  <div>{renderContent(reply.content)}</div>
                </div>
              ))}
            </div>
            <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '12px', border: '1px solid #ddd' }}>
              <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信を書く..." style={{ width: '100%', height: '80px', padding: '15px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <label style={{ cursor: 'pointer', fontSize: '13px', backgroundColor: '#fff', padding: '8px 12px', borderRadius: '8px', border: '1px solid #ccc' }}>
                  📎 添付
                  <input type="file" onChange={handleAttachFile} style={{ display: 'none' }} />
                </label>
                <button onClick={handleReplySubmit} disabled={loading} style={{ marginLeft: 'auto', backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>返信する</button>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '25px' }}>
              {blogArticles.map(article => (
                <article key={article.id} onClick={() => { setActiveArticle(article); setView('blog_read'); }} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}>
                  <div style={{ height: '180px', backgroundColor: '#f0f0f0' }}>{article.image_url && <img src={article.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                  <div style={{ padding: '20px' }}><div style={{ fontSize: '12px', color: '#5a3d8a', fontWeight: 'bold' }}>{article.genre}</div><h3 style={{ margin: '5px 0' }}>{article.title}</h3></div>
                </article>
              ))}
            </div>
          </div>
        )}

        {view === 'blog_write' && (
          <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd', maxWidth: '800px', margin: '0 auto' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← 戻る</button>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', fontSize: '28px', fontWeight: 'bold', border: 'none', borderBottom: '2px solid #eee', paddingBottom: '10px', marginBottom: '20px', outline: 'none' }} />
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
              <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="ジャンル" style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', flexGrow: 1 }} />
              <label style={{ cursor: 'pointer', padding: '8px 15px', backgroundColor: '#f0f0f0', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' }}>📷 画像<input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} style={{ display: 'none' }} /></label>
            </div>
            <div style={{ marginBottom: '10px' }}><label style={{ cursor: 'pointer', fontSize: '13px', backgroundColor: '#eee', padding: '6px 12px', borderRadius: '5px' }}>📎 添付を挿入<input type="file" onChange={handleAttachFile} style={{ display: 'none' }} /></label></div>
            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文を入力..." style={{ width: '100%', minHeight: '400px', fontSize: '16px', border: 'none', outline: 'none', resize: 'vertical' }} />
            <button onClick={handleBlogSubmit} disabled={loading} style={{ width: '100%', backgroundColor: '#00c58e', color: '#fff', padding: '15px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>公開する</button>
          </div>
        )}

        {view === 'blog_read' && activeArticle && (
          <article style={{ maxWidth: '800px', margin: '0 auto' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← 一覧へ</button>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '12px' }} />}
            <h1>{activeArticle.title}</h1>
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '20px' }}>{activeArticle.author_name} · {new Date(activeArticle.created_at).toLocaleString('ja-JP')}</div>
            <div style={{ fontSize: '18px', lineHeight: '1.9' }}>{renderContent(activeArticle.content)}</div>
          </article>
        )}
      </main>
    </div>
  );
}
