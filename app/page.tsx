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
  // 画面遷移管理
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
  const [coverPreview, setCoverPreview] = useState(''); 
  const [genre, setGenre] = useState('未分類');
  const [isNewGenre, setIsNewGenre] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 閲覧・操作用
  const [activeThread, setActiveThread] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [activeArticle, setActiveArticle] = useState<Post | null>(null);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);

  // 初期読み込み
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

  // データ取得
  async function fetchData() {
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (data) setPosts(data as Post[]);
  }

  // ブログ記事とジャンルの抽出
  const blogArticles = useMemo(() => posts.filter(p => p.category === 'blog' && !p.parent_id), [posts]);
  const existingGenres = useMemo(() => {
    const gs = Array.from(new Set(blogArticles.map(a => a.genre || '未分類')));
    return gs.filter(g => g !== '未分類').sort();
  }, [blogArticles]);

  // 掲示板スレッドと返信の抽出
  const mainThreads = posts.filter(p => !p.parent_id && p.category !== 'blog');
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  // ストレージへのアップロード
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

  // 本文中にファイルを挿入する
  async function handleFileInsert(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const res = await uploadFile(file);
    if (res) {
      const isImage = file.type.startsWith('image/');
      const tag = isImage ? `\n![画像](${res.url})\n` : `\n[📎 ${res.name}](${res.url})\n`;
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

  // いいね処理
  async function handleLike(post: Post) {
    if (likedPosts.includes(post.id)) return;
    const newLikedList = [...likedPosts, post.id];
    setLikedPosts(newLikedList);
    localStorage.setItem('robocup_liked_ids', JSON.stringify(newLikedList));
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: (p.likes || 0) + 1 } : p));
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
    } else {
      localStorage.setItem('robocup_is_admin', 'false');
      setIsAdmin(false);
    }
    alert("設定を保存しました");
    setView('home');
    setLoading(false);
  }

  // 削除処理（スレッド/ブログ/返信すべてに対応）
  async function handleDeletePost(id: string, e?: React.MouseEvent) {
    if (e) e.stopPropagation();
    if (!confirm("この記事を削除してもよろしいですか？")) return;
    setLoading(true);
    await supabase.from('posts').delete().eq('id', id);
    await supabase.from('posts').delete().eq('parent_id', id);
    if (activeThread?.id === id) setView('bbs');
    if (activeArticle?.id === id) setView('blog_list');
    await fetchData();
    setLoading(false);
  }

  // 掲示板投稿
  async function handleBbsSubmit() {
    if (!title || !content) return;
    setLoading(true);
    await supabase.from('posts').insert([{ title, content, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    setTitle(''); setContent('');
    await fetchData();
    setView('bbs');
    setLoading(false);
  }

  // 返信投稿
  async function handleReplySubmit(parentId: string) {
    if (!replyContent) return;
    setLoading(true);
    await supabase.from('posts').insert([{ content: replyContent, parent_id: parentId, author_name: profileName, author_avatar: profileAvatar, category: 'bbs' }]);
    setReplyContent(''); 
    await fetchData();
    setLoading(false);
  }

  // ブログ投稿
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
            <div onClick={() => setView('bbs')} style={{ backgroundColor: '#fff', padding: '50px 20px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '50px', marginBottom: '20px' }}>💬</div>
              <h3 style={{ margin: 0 }}>交流掲示板</h3>
            </div>
            <div onClick={() => setView('blog_list')} style={{ backgroundColor: '#fff', padding: '50px 20px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '50px', marginBottom: '20px' }}>🖋️</div>
              <h3 style={{ margin: 0 }}>技術ブログ</h3>
            </div>
          </div>
        )}

        {/* 掲示板一覧 (元のリッチなデザイン) */}
        {view === 'bbs' && (
          <div>
            <div style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', marginBottom: '30px', border: '1px solid #e0d5ed' }}>
              <h3 style={{ marginTop: 0 }}>新規スレッド作成</h3>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ marginBottom: '10px' }}>
                <label style={{ cursor: 'pointer', backgroundColor: '#fff', padding: '6px 15px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '13px', fontWeight: 'bold' }}>
                  📎 画像/ファイルを挿入 <input type="file" onChange={handleFileInsert} style={{ display: 'none' }} />
                </label>
              </div>
              <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文" style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <button onClick={handleBbsSubmit} disabled={loading} style={{ marginTop: '10px', backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 35px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>投稿</button>
            </div>
            {mainThreads.map(t => (
              <article key={t.id} onClick={() => { setActiveThread(t); setView('bbs_read'); }} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', cursor: 'pointer', border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <img src={t.author_avatar || 'https://via.placeholder.com/45'} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ flexGrow: 1 }}><h4 style={{ margin: 0, color: '#d32f2f' }}>{t.title}</h4><small>{t.author_name} · {new Date(t.created_at).toLocaleString()}</small></div>
                {isAdmin && <button onClick={(e) => handleDeletePost(t.id, e)} style={{ border: 'none', background: 'transparent' }}>🗑️</button>}
              </article>
            ))}
          </div>
        )}

        {/* 掲示板詳細 (2ちゃんねる風・わかりやすい返信欄) */}
        {view === 'bbs_read' && activeThread && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <button onClick={() => setView('bbs')} style={{ marginBottom: '20px' }}>← 掲示板に戻る</button>
            
            <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '20px', border: '1px solid #ddd', marginBottom: '20px' }}>
              <div style={{ borderBottom: '2px solid #5a3d8a', paddingBottom: '10px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
                <h2 style={{ margin: 0, color: '#5a3d8a' }}>{activeThread.title}</h2>
                {isAdmin && <button onClick={() => handleDeletePost(activeThread.id)} style={{ color: 'red', border: 'none', background: 'none' }}>スレッドを削除</button>}
              </div>

              {/* 1レス目 */}
              <div style={{ marginBottom: '30px' }}>
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                  <span style={{ color: 'green', fontWeight: 'bold' }}>1</span> : 
                  <span style={{ fontWeight: 'bold', color: '#5a3d8a', marginLeft: '5px' }}>{activeThread.author_name}</span> : 
                  {new Date(activeThread.created_at).toLocaleString()}
                </div>
                <div style={{ paddingLeft: '15px', fontSize: '17px', lineHeight: '1.8' }}>{renderContent(activeThread.content)}</div>
              </div>

              {/* 返信一覧 */}
              {getReplies(activeThread.id).map((r, i) => (
                <div key={r.id} style={{ marginBottom: '25px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
                  <div style={{ fontSize: '14px', color: '#666', marginBottom: '5px' }}>
                    <span style={{ color: 'green', fontWeight: 'bold' }}>{i + 2}</span> : 
                    <span style={{ fontWeight: 'bold', marginLeft: '5px' }}>{r.author_name}</span> : 
                    {new Date(r.created_at).toLocaleString()}
                    {isAdmin && <button onClick={() => handleDeletePost(r.id)} style={{ marginLeft: '10px', color: '#ccc', border: 'none', background: 'none' }}>🗑️</button>}
                  </div>
                  <div style={{ paddingLeft: '15px', fontSize: '16px' }}>{renderContent(r.content)}</div>
                </div>
              ))}
            </div>

            {/* 書き込み欄（2ちゃん風わかりやすいデザイン） */}
            <div style={{ backgroundColor: '#f3eef7', padding: '30px', borderRadius: '20px', border: '1px solid #e0d5ed' }}>
              <h4 style={{ marginTop: 0, marginBottom: '15px' }}>💬 スレッドに返信する</h4>
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>名前：</span>
                <input value={profileName} disabled style={{ backgroundColor: '#eee', border: '1px solid #ccc', padding: '5px 10px', borderRadius: '5px', width: '200px' }} />
                <span style={{ fontSize: '12px', color: '#888', marginLeft: '10px' }}>※設定から変更できます</span>
              </div>
              <textarea 
                value={replyContent} 
                onChange={(e) => setReplyContent(e.target.value)} 
                placeholder="内容を入力してください..." 
                style={{ width: '100%', height: '150px', padding: '15px', borderRadius: '10px', border: '1px solid #ccc', marginBottom: '15px', fontSize: '16px' }} 
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <label style={{ cursor: 'pointer', backgroundColor: '#fff', padding: '8px 15px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '13px' }}>
                  📸 画像挿入 <input type="file" onChange={handleFileInsert} style={{ display: 'none' }} />
                </label>
                <button onClick={() => handleReplySubmit(activeThread.id)} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 40px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
                  書き込む
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ブログ一覧 (元のデザイン維持) */}
        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '30px' }}>
            <aside style={{ width: '220px' }}>
              <h3 style={{ borderBottom: '2px solid #5a3d8a', paddingBottom: '10px' }}>📁 ジャンル</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                <li onClick={() => setSelectedGenre(null)} style={{ padding: '10px', cursor: 'pointer', color: !selectedGenre ? '#d32f2f' : '#666', fontWeight: !selectedGenre ? 'bold' : 'normal' }}>すべて表示</li>
                {existingGenres.map(g => (
                  <li key={g} onClick={() => setSelectedGenre(g)} style={{ padding: '10px', cursor: 'pointer', color: selectedGenre === g ? '#d32f2f' : '#666', fontWeight: selectedGenre === g ? 'bold' : 'normal' }}>{g}</li>
                ))}
              </ul>
            </aside>
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '25px' }}>
                <h2>技術ブログ</h2>
                <button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '12px 28px', borderRadius: '30px', fontWeight: 'bold' }}>＋ 記事を書く</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
                {blogArticles.filter(a => !selectedGenre || a.genre === selectedGenre).map(a => (
                  <article key={a.id} onClick={() => { setActiveArticle(a); setView('blog_read'); }} style={{ backgroundColor: '#fff', borderRadius: '18px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #eee' }}>
                    <div style={{ height: '170px', backgroundColor: '#eee' }}>{a.image_url && <img src={a.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                    <div style={{ padding: '20px' }}>
                      <span style={{ fontSize: '11px', color: '#5a3d8a', fontWeight: 'bold' }}>{a.genre}</span>
                      <h4 style={{ margin: '5px 0' }}>{a.title}</h4>
                      <small>{a.author_name} · {new Date(a.created_at).toLocaleDateString()}</small>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ブログ詳細 (元のデザイン維持) */}
        {view === 'blog_read' && activeArticle && (
          <article style={{ maxWidth: '850px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '25px', padding: '40px', border: '1px solid #eee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <button onClick={() => setView('blog_list')}>← 戻る</button>
              {isAdmin && <button onClick={() => handleDeletePost(activeArticle.id)} style={{ color: 'red', border: 'none', background: 'none' }}>🗑️ 削除</button>}
            </div>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', borderRadius: '15px', marginBottom: '30px' }} />}
            <span style={{ color: '#5a3d8a', fontWeight: 'bold' }}>{activeArticle.genre}</span>
            <h1 style={{ fontSize: '32px', marginTop: '10px' }}>{activeArticle.title}</h1>
            <div style={{ borderBottom: '1px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
              <small>{activeArticle.author_name} · {new Date(activeArticle.created_at).toLocaleString()}</small>
            </div>
            <div style={{ fontSize: '18px', lineHeight: '2.0' }}>{renderContent(activeArticle.content)}</div>
            <div style={{ marginTop: '50px', textAlign: 'center' }}>
              <button onClick={() => handleLike(activeArticle)} style={{ padding: '12px 35px', borderRadius: '30px', border: '2px solid #ff4d6d', backgroundColor: likedPosts.includes(activeArticle.id) ? '#ff4d6d' : 'white', color: likedPosts.includes(activeArticle.id) ? 'white' : '#ff4d6d', fontWeight: 'bold', cursor: 'pointer' }}>
                ❤️ {activeArticle.likes || 0}
              </button>
            </div>
          </article>
        )}

        {/* ブログ投稿 (元のデザイン維持) */}
        {view === 'blog_write' && (
          <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '25px', border: '1px solid #ddd' }}>
            <button onClick={() => setView('blog_list')} style={{ marginBottom: '20px' }}>← キャンセル</button>
            <div style={{ margin: '20px 0', height: '200px', border: '2px dashed #ddd', borderRadius: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}>
              {coverPreview ? <img src={coverPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : "🖼️ 表紙画像を選択"}
              <input type="file" accept="image/*" onChange={async (e) => { 
                const f = e.target.files?.[0]; 
                if (f) { const res = await uploadFile(f); if (res) setCoverPreview(res.url); }
              }} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>📁 ジャンル</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {!isNewGenre ? (
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '10px', borderRadius: '8px' }}>
                    <option value="未分類">未分類</option>{existingGenres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="新規ジャンル" onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '10px', borderRadius: '8px' }} />
                )}
                <button onClick={() => setIsNewGenre(!isNewGenre)}>{isNewGenre ? '戻る' : '新規作成'}</button>
              </div>
            </div>
            <div style={{ backgroundColor: '#f3eef7', padding: '15px', borderRadius: '12px', marginBottom: '15px' }}>
              <label style={{ cursor: 'pointer', backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold' }}>
                📸 本文に画像を挿入 <input type="file" onChange={handleFileInsert} style={{ display: 'none' }} />
              </label>
            </div>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル..." style={{ width: '100%', fontSize: '28px', fontWeight: 'bold', marginBottom: '20px', border: 'none', borderBottom: '2px solid #eee', outline: 'none' }} />
            <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文..." style={{ width: '100%', minHeight: '400px', padding: '20px', fontSize: '17px', borderRadius: '15px', border: '1px solid #eee' }} />
            <button onClick={handleBlogSubmit} disabled={loading} style={{ width: '100%', backgroundColor: '#00c58e', color: '#fff', padding: '15px', borderRadius: '15px', fontSize: '18px', fontWeight: 'bold', marginTop: '20px', border: 'none', cursor: 'pointer' }}>公開する</button>
          </div>
        )}

        {/* 設定画面 (元のデザイン維持) */}
        {view === 'profile' && (
          <section style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '25px', border: '1px solid #ddd' }}>
            <h2 style={{ textAlign: 'center', color: '#5a3d8a' }}>ユーザー設定</h2>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>表示名</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div style={{ marginBottom: '30px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '10px' }}>アイコン</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <img src={avatarPreview || 'https://via.placeholder.com/70'} style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover' }} />
                <input type="file" onChange={async (e) => { 
                  const f = e.target.files?.[0]; 
                  if (f) { const res = await uploadFile(f); if (res) { setProfileAvatar(res.url); setAvatarPreview(res.url); } }
                }} style={{ fontSize: '12px' }} />
              </div>
            </div>
            <div style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '15px', marginBottom: '20px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>管理者用パスワード</label>
              <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} placeholder="削除権限用" style={{ width: '100%', padding: '10px', borderRadius: '5px', border: '1px solid #ccc' }} />
            </div>
            <button onClick={saveProfile} style={{ width: '100%', backgroundColor: '#5a3d8a', color: '#fff', padding: '15px', borderRadius: '10px', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>保存して戻る</button>
          </section>
        )}
      </main>
    </div>
  );
}
