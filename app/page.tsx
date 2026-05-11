"use client";
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase接続設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LOGO_URL = "https://wkvetwjywdkwairqztsb.supabase.co/storage/v1/object/public/images/0.7302238554901188.png";

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

export default function MunakataBbsAndBlog() {
  // ★ 初期表示を 'home'（ポータル画面）に変更
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
  const [insertingImage, setInsertingImage] = useState(false);

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

  async function uploadImage(file: File) {
    const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
    const { data } = await supabase.storage.from('images').upload(fileName, file);
    if (data) {
      const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
      return pub.publicUrl;
    }
    return '';
  }

  async function saveProfile() {
    setLoading(true);
    let newAvatarUrl = profileAvatar;
    if (avatarFile) {
      const uploadedUrl = await uploadImage(avatarFile);
      if (uploadedUrl) {
        newAvatarUrl = uploadedUrl;
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
    setView('home'); // 保存後はホームに戻る
    setLoading(false);
  }

  async function handleDeletePost(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("本当にこの投稿を削除しますか？\n（スレッドの場合は返信もすべて消えます）")) return;
    
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
    let imageUrl = imageFile ? await uploadImage(imageFile) : '';
    await supabase.from('posts').insert([{ 
      title, content, image_url: imageUrl, author_name: profileName, author_avatar: profileAvatar, category: 'bbs'
    }]);
    setTitle(''); setContent(''); setImageFile(null);
    fetchData(); setLoading(false);
  }

  async function handleBlogSubmit() {
    if (!title || !content) { alert("タイトルと本文は必須です！"); return; }
    setLoading(true);
    let imageUrl = imageFile ? await uploadImage(imageFile) : '';
    const finalGenre = genre.trim() === '' ? '未分類' : genre.trim();
    
    await supabase.from('posts').insert([{ 
      title, content, image_url: imageUrl, author_name: profileName, author_avatar: profileAvatar, category: 'blog',
      genre: finalGenre
    }]);
    setTitle(''); setContent(''); setImageFile(null); setCoverPreview(''); setGenre('未分類');
    alert("ブログ記事を公開しました！");
    setView('blog_list'); fetchData(); setLoading(false);
  }

  async function handleInsertImageToContent(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setInsertingImage(true);
    const url = await uploadImage(file);
    if (url) {
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = content.substring(0, start);
        const after = content.substring(end, content.length);
        setContent(`${before}\n![画像](${url})\n${after}`);
      } else {
        setContent(prev => prev + `\n![画像](${url})\n`);
      }
    }
    setInsertingImage(false);
    e.target.value = '';
  }

  async function handleReplySubmit() {
    if (!replyContent || !activeThread) return;
    setLoading(true);
    await supabase.from('posts').insert([{ 
      content: replyContent, parent_id: activeThread.id, author_name: profileName, author_avatar: profileAvatar, category: 'bbs'
    }]);
    setReplyContent('');
    fetchData(); setLoading(false);
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
    const parts = text.split(/(!\[.*?\]\(.*?\))/g);
    return parts.map((part: string, index: number) => {
      const match = part.match(/!\[(.*?)\]\((.*?)\)/);
      if (match) {
        return <img key={index} src={match[2]} alt={match[1]} style={{ maxWidth: '100%', borderRadius: '8px', margin: '15px 0', display: 'block' }} />;
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fdfdfd', color: '#333' }}>
      
      {/* ヘッダー */}
      <header style={{ backgroundColor: '#fff', borderBottom: '4px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', cursor: 'pointer' }} onClick={() => setView('home')}>
          <img src={LOGO_URL} alt="Logo" style={{ width: '55px', height: '55px', borderRadius: '50%', border: '2px solid #5a3d8a', objectFit: 'cover' }} />
          <div>
            <h1 style={{ margin: 0, color: '#5a3d8a', fontSize: '26px', fontWeight: 'bold' }}>MunakataEPC_PORTAL</h1>
            <span style={{ fontSize: '13px', color: '#666' }}>〜 公式ポータルサイト 〜</span>
          </div>
        </div>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 15px', backgroundColor: isAdmin ? '#ffebee' : '#f3eef7', borderRadius: '30px', border: `1px solid ${isAdmin ? '#ef9a9a' : '#dcd0ea'}` }}>
          <img src={profileAvatar || 'https://via.placeholder.com/35?text=Img'} style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', color: isAdmin ? '#c62828' : '#5a3d8a' }}>{profileName} {isAdmin && '⭐'}</span>
          <span>⚙️</span>
        </div>
      </header>

      {/* ナビゲーション */}
      <nav style={{ padding: '15px 40px', display: 'flex', gap: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fff', overflowX: 'auto' }}>
        <button onClick={() => setView('home')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view === 'home' ? '#5a3d8a' : '#eee', color: view === 'home' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🏠 ホーム</button>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('bbs') ? '#5a3d8a' : '#eee', color: view.startsWith('bbs') ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>💬 掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : '#eee', color: view.startsWith('blog') ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>🖋️ ブログ</button>
        <button onClick={() => alert('スケジュール機能は現在準備中です！')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: '#eee', color: '#888', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>📅 スケジュール</button>
        <button onClick={() => alert('ギャラリー機能は現在準備中です！')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: '#eee', color: '#888', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>📷 ギャラリー</button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px' }}>
        
        {/* ================= ホーム（ポータル）画面 ================= */}
        {view === 'home' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '40px', padding: '40px 20px', backgroundColor: '#f8f5fb', borderRadius: '15px', border: '1px solid #dcd0ea' }}>
              <h2 style={{ color: '#5a3d8a', fontSize: '28px', margin: '0 0 10px 0' }}>MunakataEPC ポータルへようこそ！</h2>
              <p style={{ color: '#555', margin: 0 }}>ここは部員同士の交流や情報共有のための総合サイトです。目的のメニューを選んでください。</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              
              {/* 掲示板パネル */}
              <div 
                onClick={() => setView('bbs')}
                style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '15px', padding: '30px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = '#5a3d8a'; e.currentTarget.style.boxShadow = '0 8px 15px rgba(90,61,138,0.15)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)'; }}
              >
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>💬</div>
                <h3 style={{ color: '#333', margin: '0 0 10px 0' }}>交流掲示板</h3>
                <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>部員同士で自由にスレッドを立てて、意見交換や雑談ができます。</p>
                <div style={{ marginTop: '15px', fontSize: '12px', color: '#fff', backgroundColor: '#5a3d8a', display: 'inline-block', padding: '4px 12px', borderRadius: '20px' }}>スレッド数: {bbsThreads.length}</div>
              </div>

              {/* ブログパネル */}
              <div 
                onClick={() => setView('blog_list')}
                style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '15px', padding: '30px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = '#00c58e'; e.currentTarget.style.boxShadow = '0 8px 15px rgba(0,197,142,0.15)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#ddd'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)'; }}
              >
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>🖋️</div>
                <h3 style={{ color: '#333', margin: '0 0 10px 0' }}>活動ブログ</h3>
                <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>日々の活動記録や、ジャンルごとに分けた専門的な記事を投稿・閲覧できます。</p>
                <div style={{ marginTop: '15px', fontSize: '12px', color: '#fff', backgroundColor: '#00c58e', display: 'inline-block', padding: '4px 12px', borderRadius: '20px' }}>記事数: {blogArticles.length}</div>
              </div>

              {/* スケジュールパネル（準備中） */}
              <div 
                onClick={() => alert('スケジュール機能は現在準備中です！乞うご期待！')}
                style={{ backgroundColor: '#f9f9f9', border: '1px dashed #ccc', borderRadius: '15px', padding: '30px', cursor: 'pointer', textAlign: 'center', opacity: 0.7 }}
              >
                <div style={{ fontSize: '48px', marginBottom: '15px', filter: 'grayscale(100%)' }}>📅</div>
                <h3 style={{ color: '#888', margin: '0 0 10px 0' }}>スケジュール (準備中)</h3>
                <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>今後の練習日程や大会・イベントの予定をカレンダーで確認できるようになります。</p>
              </div>

              {/* ギャラリーパネル（準備中） */}
              <div 
                onClick={() => alert('ギャラリー機能は現在準備中です！乞うご期待！')}
                style={{ backgroundColor: '#f9f9f9', border: '1px dashed #ccc', borderRadius: '15px', padding: '30px', cursor: 'pointer', textAlign: 'center', opacity: 0.7 }}
              >
                <div style={{ fontSize: '48px', marginBottom: '15px', filter: 'grayscale(100%)' }}>📷</div>
                <h3 style={{ color: '#888', margin: '0 0 10px 0' }}>ギャラリー (準備中)</h3>
                <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>活動中の写真や動画をまとめて見られるアルバム機能を追加予定です。</p>
              </div>

            </div>
          </div>
        )}

        {/* ================= プロフィール設定 ================= */}
        {view === 'profile' && (
          <section style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd' }}>
            <h2 style={{ color: '#5a3d8a', marginTop: 0 }}>⚙️ プロフィールの設定</h2>
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
                <label style={{ fontSize: '13px', color: '#666', display: 'block', marginBottom: '5px' }}>🔑 管理者用パスワード (任意)</label>
                <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} placeholder="合言葉を入力" style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} />
              </div>
            )}
            {isAdmin && (
              <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#ffebee', color: '#c62828', borderRadius: '8px', fontWeight: 'bold' }}>
                ⭐ あなたは管理者モードです。投稿の削除が可能です。
                <button onClick={() => { localStorage.removeItem('munakata_is_admin'); setIsAdmin(false); }} style={{ marginLeft: '15px', fontSize: '12px', padding: '4px 8px', cursor: 'pointer' }}>解除する</button>
              </div>
            )}

            <button onClick={saveProfile} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 40px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>保存する</button>
          </section>
        )}

        {/* ================= 掲示板スレッド一覧画面 ================= */}
        {view === 'bbs' && (
          <div>
            <section style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', border: '1px solid #dcd0ea', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', color: '#5a3d8a', marginTop: 0 }}>💬 新しい掲示板スレッドを作成</h2>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="スレッドのタイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文" style={{ width: '100%', height: '80px', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <input type="file" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                <button onClick={handleBbsSubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>作成する</button>
              </div>
            </section>

            <div style={{ display: 'grid', gap: '15px' }}>
              {bbsThreads.map(thread => {
                const repliesCount = getReplies(thread.id).length;
                return (
                  <article 
                    key={thread.id} 
                    onClick={() => { setActiveThread(thread); setView('bbs_read'); }}
                    style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', padding: '20px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '10px', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#5a3d8a'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#ddd'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ margin: 0, color: '#b91c1c', fontSize: '20px' }}>{thread.title}</h3>
                      {isAdmin && (
                        <button onClick={(e) => handleDeletePost(thread.id, e)} style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '5px 10px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>🗑️ 削除</button>
                      )}
                    </div>
                    <div style={{ color: '#555', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {thread.content.replace(/!\[.*?\]\(.*?\)/g, '[画像]')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginTop: '10px', fontSize: '13px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={thread.author_avatar || 'https://via.placeholder.com/24'} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ fontWeight: 'bold', color: '#333' }}>{thread.author_name}</span>
                      </div>
                      <span style={{ color: '#888' }}>{new Date(thread.created_at).toLocaleString('ja-JP')}</span>
                      <span style={{ marginLeft: 'auto', backgroundColor: '#f3eef7', color: '#5a3d8a', padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold' }}>
                        返信 {repliesCount}件
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= 掲示板スレッド詳細画面（返信） ================= */}
        {view === 'bbs_read' && activeThread && (
          <div>
            <button onClick={() => setView('bbs')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px', marginBottom: '20px' }}>← スレッド一覧に戻る</button>
            
            <article style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', overflow: 'hidden', marginBottom: '30px' }}>
              <div style={{ backgroundColor: '#f8f5fb', padding: '20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <img src={activeThread.author_avatar || 'https://via.placeholder.com/50'} style={{ width: '50px', height: '50px', borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <h2 style={{ margin: 0, color: '#b91c1c', fontSize: '22px' }}>{activeThread.title}</h2>
                    <div style={{ fontSize: '14px', color: '#555', marginTop: '5px' }}>
                      <span style={{ fontWeight: 'bold' }}>{activeThread.author_name}</span> <span style={{ color: '#888', marginLeft: '10px' }}>{new Date(activeThread.created_at).toLocaleString('ja-JP')}</span>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => handleDeletePost(activeThread.id)} style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ スレッドを削除</button>
                )}
              </div>
              <div style={{ padding: '30px', fontSize: '16px', lineHeight: '1.8' }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{renderContent(activeThread.content)}</div>
                {activeThread.image_url && <img src={activeThread.image_url} style={{ maxWidth: '100%', marginTop: '20px', borderRadius: '8px' }} />}
              </div>
            </article>

            <h3 style={{ color: '#5a3d8a', borderBottom: '2px solid #dcd0ea', paddingBottom: '10px' }}>返信一覧 ({getReplies(activeThread.id).length}件)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
              {getReplies(activeThread.id).map(reply => (
                <div key={reply.id} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #eee', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <img src={reply.author_avatar || 'https://via.placeholder.com/30'} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{reply.author_name}</span>
                      <span style={{ fontSize: '12px', color: '#888' }}>{new Date(reply.created_at).toLocaleString('ja-JP')}</span>
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleDeletePost(reply.id)} style={{ background: 'none', color: '#c62828', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️ 削除</button>
                    )}
                  </div>
                  <div style={{ margin: 0, fontSize: '15px', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{renderContent(reply.content)}</div>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: '#f9f9f9', padding: '25px', borderRadius: '12px', border: '1px solid #ddd' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#333' }}>このスレッドに返信する</h4>
              <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="コメントを書く..." style={{ width: '100%', height: '100px', padding: '15px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <button onClick={handleReplySubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>送信する</button>
            </div>
          </div>
        )}

        {/* ================= ブログ機能：記事一覧 ================= */}
        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
            <div style={{ width: '220px', flexShrink: 0, backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '12px', border: '1px solid #eee', position: 'sticky', top: '100px' }}>
              <h3 style={{ fontSize: '16px', color: '#5a3d8a', marginTop: 0, borderBottom: '2px solid #dcd0ea', paddingBottom: '10px', marginBottom: '15px' }}>📁 ジャンル</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '14px', lineHeight: '2.2' }}>
                <li onClick={() => setSelectedGenre(null)} style={{ cursor: 'pointer', fontWeight: selectedGenre === null ? 'bold' : 'normal', color: selectedGenre === null ? '#b91c1c' : '#333' }}>🌐 全ての記事</li>
                {dynamicGenres.filter(g => g.id !== '未分類').map((g) => (
                  <li key={g.id} onClick={() => setSelectedGenre(g.id)} style={{ cursor: 'pointer', paddingLeft: `${g.level * 15}px`, fontWeight: selectedGenre === g.id ? 'bold' : 'normal', color: selectedGenre === g.id ? '#b91c1c' : '#555' }}>
                    {g.level === 0 ? '📂' : '📄'} {g.label}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ color: '#333', margin: 0 }}>{selectedGenre ? `「${dynamicGenres.find(g => g.id === selectedGenre)?.label}」の記事` : '最新の記事'}</h2>
                <button onClick={() => { setTitle(''); setContent(''); setImageFile(null); setCoverPreview(''); setGenre('未分類'); setView('blog_write'); }} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>＋ 記事を書く</button>
              </div>

              <div style={{ display: 'grid', gap: '25px' }}>
                {blogArticles.filter(article => selectedGenre === null || article.genre?.startsWith(selectedGenre)).map(article => (
                  <article key={article.id} onClick={() => { setActiveArticle(article); setView('blog_read'); }} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                    {article.image_url && <img src={article.image_url} alt="Cover" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />}
                    <div style={{ padding: '20px', position: 'relative' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '12px', color: '#fff', backgroundColor: '#5a3d8a', display: 'inline-block', padding: '2px 10px', borderRadius: '10px', marginBottom: '10px' }}>{article.genre || '未分類'}</div>
                        {isAdmin && (
                          <button onClick={(e) => handleDeletePost(article.id, e)} style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '3px 8px', borderRadius: '5px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>🗑️ 削除</button>
                        )}
                      </div>
                      <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', color: '#333' }}>{article.title}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '15px' }}>
                        <img src={article.author_avatar || 'https://via.placeholder.com/30'} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ fontSize: '14px', color: '#555', fontWeight: 'bold' }}>{article.author_name}</span>
                        <span style={{ fontSize: '13px', color: '#aaa', marginLeft: 'auto' }}>{new Date(article.created_at).toLocaleDateString('ja-JP')}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= ブログ機能：執筆画面 ================= */}
        {view === 'blog_write' && (
          <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd', minHeight: '600px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
              <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}>← 戻る</button>
              <button onClick={handleBlogSubmit} disabled={loading} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '30px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
                {loading ? '公開中...' : '公開する'}
              </button>
            </div>

            <div style={{ marginBottom: '20px', position: 'relative', backgroundColor: '#f9f9f9', border: '1px dashed #ccc', borderRadius: '10px', height: coverPreview ? 'auto' : '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {coverPreview ? <img src={coverPreview} style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }} /> : <span style={{ color: '#888' }}>📷 トップ用カバー画像を追加（任意）</span>}
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setImageFile(file); setCoverPreview(URL.createObjectURL(file)); }
              }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            </div>

            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>📁 ジャンル:</span>
              <input type="text" list="genre-list" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="例: hard/board" style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', flexGrow: 1, maxWidth: '300px' }} />
              <datalist id="genre-list">{dynamicGenres.map(g => <option key={g.id} value={g.id} />)}</datalist>
            </div>

            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="記事のタイトル" style={{ width: '100%', fontSize: '32px', fontWeight: 'bold', border: 'none', borderBottom: '1px solid #eee', padding: '15px 0', marginBottom: '20px', outline: 'none' }} />

            <div style={{ backgroundColor: '#f1f1f1', padding: '10px', borderRadius: '8px', marginBottom: '10px', display: 'flex', gap: '10px' }}>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', color: '#555', backgroundColor: '#fff', padding: '5px 10px', borderRadius: '5px', border: '1px solid #ccc' }}>
                <span>{insertingImage ? '⏳ アップロード中...' : '🖼️ 本文に画像を挿入'}</span>
                <input type="file" accept="image/*" disabled={insertingImage} onChange={handleInsertImageToContent} style={{ display: 'none' }} />
              </label>
              <span style={{ fontSize: '12px', color: '#888', alignSelf: 'center' }}>※カーソルを合わせた位置に画像が挿入されます</span>
            </div>

            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="ここに本文を書く..." style={{ width: '100%', minHeight: '400px', fontSize: '18px', lineHeight: '1.8', border: 'none', outline: 'none', resize: 'vertical' }} />
          </div>
        )}

        {/* ================= ブログ機能：閲覧画面 ================= */}
        {view === 'blog_read' && activeArticle && (
          <article style={{ backgroundColor: '#fff', padding: '40px 0', borderRadius: '15px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 20px', marginBottom: '20px' }}>
              <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px' }}>← 記事一覧に戻る</button>
              {isAdmin && (
                <button onClick={() => handleDeletePost(activeArticle.id)} style={{ background: '#ffebee', color: '#c62828', border: 'none', padding: '8px 15px', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ この記事を削除する</button>
              )}
            </div>
            
            {activeArticle.image_url && <img src={activeArticle.image_url} alt="Cover" style={{ width: '100%', maxHeight: '450px', objectFit: 'cover', borderRadius: '10px', marginBottom: '30px' }} />}
            
            <div style={{ padding: '0 40px' }}>
              <div style={{ fontSize: '13px', color: '#5a3d8a', fontWeight: 'bold', marginBottom: '10px' }}>📁 {activeArticle.genre || '未分類'}</div>
              <h1 style={{ fontSize: '36px', margin: '0 0 20px 0', color: '#222', lineHeight: '1.4' }}>{activeArticle.title}</h1>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '40px', paddingBottom: '20px', borderBottom: '1px solid #eee' }}>
                <img src={activeArticle.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>{activeArticle.author_name}</div>
                  <div style={{ fontSize: '13px', color: '#888' }}>{new Date(activeArticle.created_at).toLocaleString('ja-JP')}</div>
                </div>
              </div>

              <div style={{ fontSize: '18px', lineHeight: '2.0', color: '#333', letterSpacing: '0.03em', whiteSpace: 'pre-wrap' }}>
                {renderContent(activeArticle.content)}
              </div>
            </div>
          </article>
        )}

      </main>
    </div>
  );
}
