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
  
  // 各入力欄のRef（カーソル位置への挿入用）
  const bbsTextareaRef = useRef<HTMLTextAreaElement>(null);
  const blogTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [activeThread, setActiveThread] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<Post | null>(null);
  const [isUploading, setIsUploading] = useState(false);

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

  // ファイルアップロード汎用関数
  async function uploadFile(file: File) {
    const fileName = `${Math.random()}_${file.name}`;
    const { data, error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) { alert("アップロード失敗: " + error.message); return null; }
    const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
    return { url: pub.publicUrl, name: file.name };
  }

  // 指定した textarea のカーソル位置にテキストを挿入する
  const insertTextAtCursor = (ref: React.RefObject<HTMLTextAreaElement>, text: string, setter: React.Dispatch<React.SetStateAction<string>>) => {
    const textarea = ref.current;
    if (!textarea) {
      setter(prev => prev + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setter(prev => prev.substring(0, start) + text + prev.substring(end));
    // 挿入後にフォーカスを戻す
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 10);
  };

  // ファイル添付ハンドラー（画像かファイルか判断して挿入）
  async function handleFileAttach(e: React.ChangeEvent<HTMLInputElement>, ref: React.RefObject<HTMLTextAreaElement>, setter: React.Dispatch<React.SetStateAction<string>>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const res = await uploadFile(file);
    if (res) {
      const isImage = file.type.startsWith('image/');
      const insertTag = isImage ? `\n![${res.name}](${res.url})\n` : `\n[📎 添付ファイル: ${res.name}](${res.url})\n`;
      insertTextAtCursor(ref, insertTag, setter);
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

  async function handleReplySubmit() {
    if (!replyContent || !activeThread) return;
    setLoading(true);
    await supabase.from('posts').insert([{ 
      content: replyContent, parent_id: activeThread.id, author_name: profileName, author_avatar: profileAvatar, category: 'bbs'
    }]);
    setReplyContent(''); fetchData(); setLoading(false);
  }

  async function handleBlogSubmit() {
    if (!title || !content) { alert("タイトルと本文は必須です！"); return; }
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
    return [
      { id: '未分類', label: '未分類', level: 0 },
      ...Array.from(genreSet).sort().map(path => {
        const parts = path.split('/');
        return { id: path, label: parts[parts.length - 1], level: parts.length - 1 };
      })
    ];
  }, [blogArticles]);

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
    <div style={{ minHeight: '100vh', backgroundColor: '#fdfdfd', color: '#333' }}>
      
      <header style={{ backgroundColor: '#fff', borderBottom: '4px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', cursor: 'pointer' }} onClick={() => setView('home')}>
          <img src={LOGO_URL} style={{ width: '55px', height: '55px', borderRadius: '50%', border: '2px solid #5a3d8a', objectFit: 'cover' }} />
          <div>
            <h1 style={{ margin: 0, color: '#5a3d8a', fontSize: '26px', fontWeight: 'bold' }}>MunakataEPC_PORTAL</h1>
            <span style={{ fontSize: '13px', color: '#666' }}>〜 公式ポータルサイト 〜</span>
          </div>
        </div>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 15px', backgroundColor: isAdmin ? '#ffebee' : '#f3eef7', borderRadius: '30px', border: `1px solid ${isAdmin ? '#ef9a9a' : '#dcd0ea'}` }}>
          <img src={profileAvatar || 'https://via.placeholder.com/35?text=👤'} style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', color: isAdmin ? '#c62828' : '#5a3d8a' }}>{profileName} {isAdmin && '⭐'}</span>
          <span>⚙️</span>
        </div>
      </header>

      <nav style={{ padding: '15px 40px', display: 'flex', gap: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fff', overflowX: 'auto' }}>
        <button onClick={() => setView('home')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view === 'home' ? '#5a3d8a' : '#eee', color: view === 'home' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>🏠 ホーム</button>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('bbs') ? '#5a3d8a' : '#eee', color: view.startsWith('bbs') ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>💬 掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : '#eee', color: view.startsWith('blog') ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>🖋️ ブログ</button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px' }}>
        
        {view === 'home' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: '40px', padding: '40px 20px', backgroundColor: '#f8f5fb', borderRadius: '15px', border: '1px solid #dcd0ea' }}>
              <h2 style={{ color: '#5a3d8a', fontSize: '28px', margin: '0 0 10px 0' }}>MunakataEPC ポータルへようこそ！</h2>
              <p style={{ color: '#555', margin: 0 }}>部員同士の交流や情報共有のための総合サイトです。目的のメニューを選んでください。</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              <div onClick={() => setView('bbs')} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '15px', padding: '30px', cursor: 'pointer', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>💬</div>
                <h3>交流掲示板</h3>
                <p style={{ color: '#666', fontSize: '14px' }}>自由にスレッドを立てて意見交換や雑談ができます。</p>
                <div style={{ marginTop: '15px', fontSize: '12px', color: '#fff', backgroundColor: '#5a3d8a', display: 'inline-block', padding: '4px 12px', borderRadius: '20px' }}>スレッド: {bbsThreads.length}</div>
              </div>
              <div onClick={() => setView('blog_list')} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '15px', padding: '30px', cursor: 'pointer', textAlign: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ fontSize: '48px', marginBottom: '15px' }}>🖋️</div>
                <h3>活動ブログ</h3>
                <p style={{ color: '#666', fontSize: '14px' }}>日々の活動記録や、専門的な技術記事を投稿・閲覧できます。</p>
                <div style={{ marginTop: '15px', fontSize: '12px', color: '#fff', backgroundColor: '#00c58e', display: 'inline-block', padding: '4px 12px', borderRadius: '20px' }}>記事数: {blogArticles.length}</div>
              </div>
              <div style={{ backgroundColor: '#f9f9f9', border: '1px dashed #ccc', borderRadius: '15px', padding: '30px', textAlign: 'center', opacity: 0.7 }}>
                <div style={{ fontSize: '48px', marginBottom: '15px', filter: 'grayscale(100%)' }}>📅</div>
                <h3 style={{ color: '#888' }}>スケジュール (準備中)</h3>
                <p style={{ color: '#999', fontSize: '14px' }}>練習日程や大会の予定を確認できるようになります。</p>
              </div>
              <div style={{ backgroundColor: '#f9f9f9', border: '1px dashed #ccc', borderRadius: '15px', padding: '30px', textAlign: 'center', opacity: 0.7 }}>
                <div style={{ fontSize: '48px', marginBottom: '15px', filter: 'grayscale(100%)' }}>📷</div>
                <h3 style={{ color: '#888' }}>ギャラリー (準備中)</h3>
                <p style={{ color: '#999', fontSize: '14px' }}>活動中の写真や動画をまとめて見られる予定です。</p>
              </div>
            </div>
          </div>
        )}

        {view === 'bbs' && (
          <div>
            <section style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', border: '1px solid #dcd0ea', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', color: '#5a3d8a', marginTop: 0 }}>💬 新しいスレッドを作成</h2>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <textarea ref={bbsTextareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="内容を入力..." style={{ width: '100%', height: '100px', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ cursor: 'pointer', fontSize: '14px', color: '#5a3d8a', fontWeight: 'bold' }}>
                  {isUploading ? '⏳ 読込中...' : '📎 画像/ファイルを挿入'}
                  <input type="file" onChange={(e) => handleFileAttach(e, bbsTextareaRef, setContent)} style={{ display: 'none' }} />
                </label>
                <button onClick={handleBbsSubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>投稿する</button>
              </div>
            </section>
            <div style={{ display: 'grid', gap: '15px' }}>
              {bbsThreads.map(thread => (
                <article key={thread.id} onClick={() => { setActiveThread(thread); setView('bbs_read'); }} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: '0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
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
            <button onClick={() => setView('bbs')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← スレッド一覧へ</button>
            <article style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', overflow: 'hidden', marginBottom: '30px' }}>
              <div style={{ backgroundColor: '#f8f5fb', padding: '20px', borderBottom: '1px solid #eee' }}>
                <h2 style={{ color: '#b91c1c', margin: 0 }}>{activeThread.title}</h2>
                <div style={{ fontSize: '14px', color: '#555', marginTop: '5px' }}>{activeThread.author_name} · {new Date(activeThread.created_at).toLocaleString('ja-JP')}</div>
              </div>
              <div style={{ padding: '30px', lineHeight: '1.8' }}>{renderContent(activeThread.content)}</div>
            </article>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '40px' }}>
              {getReplies(activeThread.id).map(reply => (
                <div key={reply.id} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '10px', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{reply.author_name}</span>
                    {isAdmin && <button onClick={() => handleDeletePost(reply.id)} style={{ border: 'none', background: 'none', color: '#c62828' }}>🗑️</button>}
                  </div>
                  <div>{renderContent(reply.content)}</div>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: '#f9f9f9', padding: '25px', borderRadius: '12px', border: '1px solid #ddd' }}>
              <textarea ref={replyTextareaRef} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信を書く..." style={{ width: '100%', height: '100px', padding: '15px', marginBottom: '15px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ cursor: 'pointer', fontSize: '14px', color: '#5a3d8a' }}>
                  📎 ファイルを挿入
                  <input type="file" onChange={(e) => handleFileAttach(e, replyTextareaRef, setReplyContent)} style={{ display: 'none' }} />
                </label>
                <button onClick={handleReplySubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>返信する</button>
              </div>
            </div>
          </div>
        )}

        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '30px' }}>
            <div style={{ width: '220px', flexShrink: 0 }}>
              <h3 style={{ fontSize: '16px', color: '#5a3d8a', borderBottom: '2px solid #dcd0ea', paddingBottom: '10px' }}>📁 ジャンル</h3>
              <ul style={{ listStyle: 'none', padding: 0, lineHeight: '2.5', fontSize: '14px' }}>
                <li onClick={() => setSelectedGenre(null)} style={{ cursor: 'pointer', fontWeight: selectedGenre === null ? 'bold' : 'normal', color: selectedGenre === null ? '#b91c1c' : '#333' }}>🌐 全ての記事</li>
                {dynamicGenres.filter(g => g.id !== '未分類').map(g => (
                  <li key={g.id} onClick={() => setSelectedGenre(g.id)} style={{ cursor: 'pointer', paddingLeft: `${g.level * 15}px`, fontWeight: selectedGenre === g.id ? 'bold' : 'normal', color: selectedGenre === g.id ? '#b91c1c' : '#555' }}>{g.level === 0 ? '📂' : '📄'} {g.label}</li>
                ))}
              </ul>
            </div>
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>{selectedGenre ? `「${selectedGenre}」の記事` : '最新のブログ記事'}</h2>
                <button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '10px 25px', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer' }}>＋ 記事を書く</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
                {blogArticles.filter(a => !selectedGenre || a.genre?.startsWith(selectedGenre)).map(article => (
                  <article key={article.id} onClick={() => { setActiveArticle(article); setView('blog_read'); }} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer' }}>
                    <div style={{ height: '180px', backgroundColor: '#f0f0f0' }}>{article.image_url && <img src={article.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                    <div style={{ padding: '20px' }}>
                      <div style={{ fontSize: '12px', color: '#fff', backgroundColor: '#5a3d8a', display: 'inline-block', padding: '2px 10px', borderRadius: '10px', marginBottom: '10px' }}>{article.genre}</div>
                      <h3 style={{ margin: '0 0 10px 0' }}>{article.title}</h3>
                      <div style={{ fontSize: '12px', color: '#999' }}>{article.author_name} · {new Date(article.created_at).toLocaleDateString()}</div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === 'blog_write' && (
          <div style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd', maxWidth: '800px', margin: '0 auto' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← 戻る</button>
            <div style={{ marginBottom: '20px', background: '#f9f9f9', border: '1px dashed #ccc', borderRadius: '10px', height: coverPreview ? 'auto' : '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
              {coverPreview ? <img src={coverPreview} style={{ width: '100%', maxHeight: '300px', objectFit: 'cover' }} /> : <span style={{ color: '#888' }}>📷 カバー画像を選択（任意）</span>}
              <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setImageFile(file); setCoverPreview(URL.createObjectURL(file)); } }} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </div>
            <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="ジャンル (例: board/moter)" style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #ccc' }} />
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', fontSize: '28px', fontWeight: 'bold', border: 'none', borderBottom: '1px solid #eee', marginBottom: '20px', outline: 'none' }} />
            <div style={{ background: '#f1f1f1', padding: '10px', borderRadius: '8px', marginBottom: '10px', display: 'flex', gap: '15px' }}>
              <label style={{ cursor: 'pointer', fontSize: '14px', background: '#fff', padding: '5px 15px', borderRadius: '5px', border: '1px solid #ccc' }}>
                {isUploading ? 'アップロード中...' : '🖼️ 画像/ファイルを本文に挿入'}
                <input type="file" onChange={(e) => handleFileAttach(e, blogTextareaRef, setContent)} style={{ display: 'none' }} />
              </label>
              <span style={{ fontSize: '12px', color: '#888', alignSelf: 'center' }}>※カーソル位置に挿入されます</span>
            </div>
            <textarea ref={blogTextareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文を入力..." style={{ width: '100%', minHeight: '400px', fontSize: '18px', border: 'none', outline: 'none', resize: 'vertical', lineHeight: '1.8' }} />
            <button onClick={handleBlogSubmit} disabled={loading} style={{ width: '100%', backgroundColor: '#00c58e', color: '#fff', padding: '15px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', marginTop: '20px' }}>記事を公開する</button>
          </div>
        )}

        {view === 'blog_read' && activeArticle && (
          <article style={{ maxWidth: '800px', margin: '0 auto' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← 記事一覧へ</button>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', maxHeight: '400px', objectFit: 'cover', borderRadius: '12px', marginBottom: '30px' }} />}
            <div style={{ fontSize: '13px', color: '#5a3d8a', fontWeight: 'bold' }}>📁 {activeArticle.genre}</div>
            <h1 style={{ fontSize: '36px', marginTop: '10px' }}>{activeArticle.title}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
              <img src={activeArticle.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
              <div>
                <div style={{ fontWeight: 'bold' }}>{activeArticle.author_name}</div>
                <div style={{ fontSize: '12px', color: '#888' }}>{new Date(activeArticle.created_at).toLocaleString('ja-JP')}</div>
              </div>
              {isAdmin && <button onClick={() => handleDeletePost(activeArticle.id)} style={{ marginLeft: 'auto', color: '#c62828', border: 'none', background: 'none', cursor: 'pointer' }}>🗑️ 削除</button>}
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
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>アイコン画像</label>
              <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setAvatarFile(file); setAvatarPreview(URL.createObjectURL(file)); } }} />
              {(avatarPreview || profileAvatar) && <img src={avatarPreview || profileAvatar} style={{ width: '80px', height: '80px', borderRadius: '50%', marginTop: '15px', objectFit: 'cover' }} />}
            </div>
            {!isAdmin && (
              <div style={{ marginBottom: '30px', padding: '15px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '1px dashed #ccc' }}>
                <label style={{ fontSize: '13px', color: '#666' }}>🔑 管理者用パスワード (admin1234)</label>
                <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '5px' }} />
              </div>
            )}
            <button onClick={saveProfile} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 40px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>保存する</button>
          </section>
        )}

      </main>
    </div>
  );
}
