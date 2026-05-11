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
  const [genre, setGenre] = useState('未分類');
  
  // 掲示板・ブログ閲覧用
  const [activeThread, setActiveThread] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [activeArticle, setActiveArticle] = useState<Post | null>(null);
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
    }
    setAvatarFile(null); setAvatarPreview(''); setAdminPassInput('');
    alert("プロフィールを保存しました！");
    setView('home');
    setLoading(false);
  }

  // ファイル添付機能の改善（掲示板/ブログ/返信すべてに対応）
  async function handleAttachFile(e: React.ChangeEvent<HTMLInputElement>, target: 'post' | 'reply') {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFile(true);
    const res = await uploadToStorage(file);
    if (res) {
      const fileLink = `\n\n[📎 添付ファイル: ${res.name}](${res.url})`;
      if (target === 'reply') {
        setReplyContent(prev => prev + fileLink);
      } else {
        setContent(prev => prev + fileLink);
      }
      alert(`${res.name} を挿入しました！`);
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
    await supabase.from('posts').insert([{ 
      title, content, author_name: profileName, author_avatar: profileAvatar, category: 'bbs'
    }]);
    setTitle(''); setContent(''); fetchData(); setLoading(false);
  }

  // ★ 修正：欠落していた返信送信関数を追加
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
    await supabase.from('posts').insert([{ 
      title, content, image_url: imageUrl, author_name: profileName, author_avatar: profileAvatar, category: 'blog', genre: genre.trim() || '未分類'
    }]);
    setTitle(''); setContent(''); setImageFile(null); setGenre('未分類');
    setView('blog_list'); fetchData(); setLoading(false);
  }

  const mainThreads = posts.filter(p => !p.parent_id);
  const bbsThreads = mainThreads.filter(p => p.category !== 'blog');
  const blogArticles = mainThreads.filter(p => p.category === 'blog');
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).reverse();

  // 内容の表示（画像と添付ボタンのレンダリング）
  const renderContent = (text: string) => {
    const parts = text.split(/(!\[.*?\]\(.*?\)|\[.*?\]\(.*?\))/g);
    return parts.map((part: string, index: number) => {
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
      
      {/* ヘッダー */}
      <header style={{ backgroundColor: '#fff', borderBottom: '4px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ cursor: 'pointer' }} onClick={() => setView('home')}>
          <h1 style={{ margin: 0, color: '#5a3d8a', fontSize: '24px', fontWeight: 'bold' }}>ロボカップ情報共有</h1>
          <span style={{ fontSize: '12px', color: '#666' }}>〜 交流サイト 〜</span>
        </div>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 15px', backgroundColor: isAdmin ? '#ffebee' : '#f3eef7', borderRadius: '30px' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/35?text=👤'} style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', color: isAdmin ? '#c62828' : '#5a3d8a' }}>{profileName}</span>
          <span>⚙️</span>
        </div>
      </header>

      {/* ナビゲーション */}
      <nav style={{ padding: '10px 40px', display: 'flex', gap: '10px', borderBottom: '1px solid #eee', backgroundColor: '#fff' }}>
        <button onClick={() => setView('home')} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', backgroundColor: view === 'home' ? '#5a3d8a' : 'transparent', color: view === 'home' ? '#fff' : '#555', cursor: 'pointer' }}>🏠 ホーム</button>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('bbs') ? '#5a3d8a' : 'transparent', color: view.startsWith('bbs') ? '#fff' : '#555', cursor: 'pointer' }}>💬 掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '8px 20px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : 'transparent', color: view.startsWith('blog') ? '#fff' : '#555', cursor: 'pointer' }}>🖋️ ブログ</button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px' }}>
        
        {/* ホーム */}
        {view === 'home' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ padding: '60px 20px', background: 'linear-gradient(135deg, #f3eef7 0%, #ffffff 100%)', borderRadius: '20px', marginBottom: '40px', border: '1px solid #dcd0ea' }}>
              <h2 style={{ color: '#5a3d8a', fontSize: '32px', marginBottom: '15px' }}>情報を共有して、開発を加速させよう</h2>
              <p style={{ color: '#666' }}>ロボカップに関する技術、予定、雑談など、何でも自由に投稿してください。</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div onClick={() => setView('bbs')} style={{ padding: '40px', backgroundColor: '#fff', borderRadius: '15px', border: '1px solid #ddd', cursor: 'pointer' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>💬</div>
                <h3>交流掲示板</h3>
                <p style={{ fontSize: '14px', color: '#888' }}>軽い質問やチーム連絡、ファイル共有に。</p>
              </div>
              <div onClick={() => setView('blog_list')} style={{ padding: '40px', backgroundColor: '#fff', borderRadius: '15px', border: '1px solid #ddd', cursor: 'pointer' }}>
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>🖋️</div>
                <h3>技術ブログ</h3>
                <p style={{ fontSize: '14px', color: '#888' }}>回路図やプログラムの解説、制作ログに。</p>
              </div>
            </div>
          </div>
        )}

        {/* 掲示板一覧 (UIを参考画像風に改善) */}
        {view === 'bbs' && (
          <div>
            <section style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '12px', border: '1px solid #ddd', marginBottom: '30px' }}>
              <h3 style={{ marginTop: 0, color: '#5a3d8a' }}>新しくスレッドを立てる</h3>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="スレッドのタイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="内容を入力..." style={{ width: '100%', height: '80px', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', alignItems: 'center' }}>
                <label style={{ cursor: 'pointer', color: '#5a3d8a', fontSize: '14px', fontWeight: 'bold' }}>
                  📎 ファイルを添付
                  <input type="file" onChange={(e) => handleAttachFile(e, 'post')} style={{ display: 'none' }} />
                </label>
                <button onClick={handleBbsSubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 25px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>投稿する</button>
              </div>
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {bbsThreads.map(thread => (
                <div key={thread.id} onClick={() => { setActiveThread(thread); setView('bbs_read'); }} style={{ display: 'flex', backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #eee', cursor: 'pointer', gap: '20px', alignItems: 'center', transition: '0.2s' }}>
                  <img src={thread.author_avatar || 'https://via.placeholder.com/50?text=👤'} style={{ width: '60px', height: '60px', borderRadius: '10px', objectFit: 'cover' }} />
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: '0 0 5px 0', color: '#b91c1c' }}>{thread.title}</h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {thread.content.replace(/\[.*?\]\(.*?\)/g, '')}
                    </p>
                    <div style={{ marginTop: '10px', fontSize: '12px', color: '#999', display: 'flex', gap: '15px' }}>
                      <span>投稿者: {thread.author_name}</span>
                      <span>{new Date(thread.created_at).toLocaleString('ja-JP')}</span>
                      <span style={{ color: '#5a3d8a', fontWeight: 'bold' }}>返信 {getReplies(thread.id).length}件</span>
                    </div>
                  </div>
                  {isAdmin && <button onClick={(e) => handleDeletePost(thread.id, e)} style={{ border: 'none', background: '#f8f8f8', padding: '10px', borderRadius: '5px', cursor: 'pointer' }}>🗑️</button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 掲示板詳細 */}
        {view === 'bbs_read' && activeThread && (
          <div>
            <button onClick={() => setView('bbs')} style={{ border: 'none', background: 'none', color: '#888', cursor: 'pointer', marginBottom: '15px' }}>← スレッド一覧に戻る</button>
            <article style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '12px', border: '1px solid #ddd', marginBottom: '20px' }}>
              <h2 style={{ color: '#b91c1c', marginTop: 0 }}>{activeThread.title}</h2>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>{activeThread.author_name} · {new Date(activeThread.created_at).toLocaleString('ja-JP')}</div>
              <div style={{ lineHeight: '1.7' }}>{renderContent(activeThread.content)}</div>
            </article>

            {getReplies(activeThread.id).map(reply => (
              <div key={reply.id} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', borderBottom: '1px solid #eee', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{reply.author_name}</span>
                  {isAdmin && <button onClick={() => handleDeletePost(reply.id)} style={{ border: 'none', background: 'none', color: '#c62828', cursor: 'pointer' }}>🗑️</button>}
                </div>
                <div>{renderContent(reply.content)}</div>
              </div>
            ))}

            <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f8f8f8', borderRadius: '12px' }}>
              <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信を入力..." style={{ width: '100%', height: '80px', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', marginBottom: '10px' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ cursor: 'pointer', color: '#5a3d8a', fontSize: '14px' }}>
                  📎 ファイル添付
                  <input type="file" onChange={(e) => handleAttachFile(e, 'reply')} style={{ display: 'none' }} />
                </label>
                <button onClick={handleReplySubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>返信する</button>
              </div>
            </div>
          </div>
        )}

        {/* ブログ一覧 */}
        {view === 'blog_list' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
              <h2 style={{ margin: 0 }}>技術ブログ</h2>
              <button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '10px 25px', border: 'none', borderRadius: '25px', cursor: 'pointer', fontWeight: 'bold' }}>＋ 記事を書く</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {blogArticles.map(article => (
                <div key={article.id} onClick={() => { setActiveArticle(article); setView('blog_read'); }} style={{ backgroundColor: '#fff', borderRadius: '12px', overflow: 'hidden', border: '1px solid #eee', cursor: 'pointer' }}>
                  <div style={{ height: '160px', backgroundColor: '#f0f0f0' }}>
                    {article.image_url && <img src={article.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ padding: '15px' }}>
                    <span style={{ fontSize: '12px', color: '#5a3d8a', fontWeight: 'bold' }}>{article.genre}</span>
                    <h3 style={{ margin: '5px 0', fontSize: '18px' }}>{article.title}</h3>
                    <div style={{ fontSize: '12px', color: '#999' }}>{article.author_name} · {new Date(article.created_at).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* プロフィール設定 */}
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
                <img src={avatarPreview || profileAvatar} style={{ width: '80px', height: '80px', borderRadius: '50%', marginTop: '15px', objectFit: 'cover' }} />
              )}
            </div>
            <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
              <label style={{ fontSize: '13px', color: '#666', display: 'block' }}>🔑 管理者用パスワード (admin1234)</label>
              <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '5px' }} />
            </div>
            <button onClick={saveProfile} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 40px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>保存する</button>
          </section>
        )}

      </main>
    </div>
  );
}
