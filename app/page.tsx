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
  const [imageFile, setImageFile] = useState<File | null>(null);
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
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage.from('images').upload(fileName, file);
    if (error) return null;
    const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
    return { url: pub.publicUrl, name: file.name };
  }

  // ★画像追加ロジックの修正
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
        // setContentを使い、かつカーソル位置を保持する
        const newText = content.substring(0, start) + tag + content.substring(end);
        setContent(newText);
        
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 10);
      } else {
        // テキストエリアにフォーカスがない場合は末尾に追加
        setContent(prev => prev + tag);
      }
    }
    setLoading(false);
    e.target.value = ''; // 同じファイルを連続で上げられるようにリセット
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

  async function handleBlogSubmit() {
    if (!title || !content) { alert("タイトルと本文を入力してください"); return; }
    setLoading(true);
    try {
      const finalGenre = isNewGenre ? genre : (genre === '未分類' ? '未分類' : genre);
      const { error } = await supabase.from('posts').insert([{ 
        title, content, image_url: coverPreview, author_name: profileName, author_avatar: profileAvatar, category: 'blog', genre: finalGenre
      }]);
      if (error) throw error;
      setTitle(''); setContent(''); setImageFile(null); setCoverPreview(''); setGenre('未分類');
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

  // --- UI部分は元のリッチなデザインを完全に維持 ---
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', color: '#333', fontFamily: 'sans-serif' }}>
      
      {/* ヘッダー */}
      <header style={{ backgroundColor: '#fff', borderBottom: '3px solid #5a3d8a', padding: '15px 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 100 }}>
        <h1 onClick={() => setView('home')} style={{ margin: 0, fontSize: '22px', color: '#5a3d8a', cursor: 'pointer', fontWeight: '900' }}>
          ロボカップ情報共有
        </h1>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 15px', backgroundColor: '#f3eef7', borderRadius: '30px' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/30'} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{profileName}{isAdmin && ' (Admin)'}</span>
        </div>
      </header>

      {/* メインナビ */}
      <nav style={{ padding: '12px 40px', display: 'flex', gap: '10px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
        <button onClick={() => setView('home')} style={{ padding: '8px 25px', border: 'none', borderRadius: '5px', backgroundColor: view === 'home' ? '#5a3d8a' : 'transparent', color: view === 'home' ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>🏠 ホーム</button>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 25px', border: 'none', borderRadius: '5px', backgroundColor: view.startsWith('bbs') ? '#5a3d8a' : 'transparent', color: view.startsWith('bbs') ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>💬 掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '8px 25px', border: 'none', borderRadius: '5px', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : 'transparent', color: view.startsWith('blog') ? '#fff' : '#666', cursor: 'pointer', fontWeight: 'bold' }}>🖋️ ブログ</button>
      </nav>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '30px 20px' }}>
        
        {/* ホーム画面 */}
        {view === 'home' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '25px' }}>
            <div onClick={() => setView('bbs')} style={{ backgroundColor: '#fff', padding: '50px 20px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '50px', marginBottom: '20px' }}>💬</div>
              <h3 style={{ margin: 0, fontSize: '22px' }}>交流掲示板</h3>
              <p style={{ color: '#888', marginTop: '10px' }}>質問・雑談・お知らせはこちら</p>
            </div>
            <div onClick={() => setView('blog_list')} style={{ backgroundColor: '#fff', padding: '50px 20px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer', border: '1px solid #eee', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ fontSize: '50px', marginBottom: '20px' }}>🖋️</div>
              <h3 style={{ margin: 0, fontSize: '22px' }}>技術ブログ</h3>
              <p style={{ color: '#888', marginTop: '10px' }}>活動報告・ノウハウの蓄積はこちら</p>
            </div>
          </div>
        )}

        {/* 掲示板一覧 */}
        {view === 'bbs' && (
          <div>
            <div style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', marginBottom: '30px', border: '1px solid #e0d5ed' }}>
              <h3 style={{ marginTop: 0, color: '#5a3d8a' }}>新規スレッド作成</h3>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="スレッドのタイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ marginBottom: '10px' }}>
                <label style={{ cursor: 'pointer', backgroundColor: '#fff', padding: '6px 15px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '13px', fontWeight: 'bold' }}>
                  📎 本文に画像/ファイルを添付
                  <input type="file" onChange={handleFileInsert} style={{ display: 'none' }} />
                </label>
              </div>
              <textarea ref={textareaRef} value={content} onChange={(e) => setContent(e.target.value)} placeholder="内容を入力してください..." style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '15px' }} />
              <button onClick={handleBbsSubmit} disabled={loading} style={{ marginTop: '10px', backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 35px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                {loading ? '送信中...' : '投稿する'}
              </button>
            </div>
            {mainThreads.map(t => (
              <article key={t.id} onClick={() => { setActiveThread(t); setView('bbs_read'); }} style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '15px', marginBottom: '15px', cursor: 'pointer', border: '1px solid #eee', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <img src={t.author_avatar || 'https://via.placeholder.com/45'} style={{ width: '45px', height: '45px', borderRadius: '50%', objectFit: 'cover' }} />
                <div style={{ flexGrow: 1 }}>
                  <h4 style={{ margin: '0 0 5px 0', color: '#d32f2f', fontSize: '18px' }}>{t.title}</h4>
                  <div style={{ fontSize: '13px', color: '#888' }}>{t.author_name} · {new Date(t.created_at).toLocaleString()}</div>
                </div>
                {isAdmin && <button onClick={(e) => handleDeletePost(t.id, e)} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer' }}>🗑️</button>}
              </article>
            ))}
          </div>
        )}

        {/* 掲示板詳細 */}
        {view === 'bbs_read' && activeThread && (
          <div>
            <button onClick={() => setView('bbs')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px', fontSize: '16px' }}>← 掲示板に戻る</button>
            <div style={{ backgroundColor: '#fff', padding: '30px', borderRadius: '20px', border: '1px solid #ddd', marginBottom: '30px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '25px' }}>
                <img src={activeThread.author_avatar || 'https://via.placeholder.com/50'} style={{ width: '50px', height: '50px', borderRadius: '50%' }} />
                <div>
                  <h2 style={{ margin: 0, color: '#d32f2f', fontSize: '24px' }}>{activeThread.title}</h2>
                  <div style={{ fontSize: '13px', color: '#888' }}>{activeThread.author_name} · {new Date(activeThread.created_at).toLocaleString()}</div>
                </div>
              </div>
              <div style={{ fontSize: '17px', lineHeight: '1.8' }}>{renderContent(activeThread.content)}</div>
            </div>

            <div style={{ marginBottom: '40px' }}>
              {getReplies(activeThread.id).map(r => (
                <div key={r.id} style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                  <img src={r.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '40px', height: '40px', borderRadius: '50%', marginTop: '5px' }} />
                  <div style={{ flexGrow: 1, backgroundColor: '#fff', padding: '18px', borderRadius: '15px', border: '1px solid #eee', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>{r.author_name}</div>
                      <div style={{ fontSize: '11px', color: '#bbb' }}>{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <div style={{ fontSize: '15px' }}>{renderContent(r.content)}</div>
                    {isAdmin && <button onClick={() => handleDeletePost(r.id)} style={{ position: 'absolute', right: '10px', bottom: '10px', background: 'none', border: 'none', color: '#eee', fontSize: '12px' }}>🗑️</button>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '20px', border: '1px solid #ddd' }}>
              <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信を書く..." style={{ width: '100%', height: '100px', padding: '15px', borderRadius: '12px', border: '1px solid #eee', fontSize: '15px', outline: 'none' }} />
              <button onClick={() => handleReplySubmit(activeThread.id)} style={{ marginTop: '10px', backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 35px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>返信する</button>
            </div>
          </div>
        )}

        {/* ブログ一覧 */}
        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '30px' }}>
            <aside style={{ width: '220px', flexShrink: 0 }}>
              <h3 style={{ color: '#5a3d8a', borderBottom: '2px solid #5a3d8a', paddingBottom: '10px', fontSize: '18px' }}>📁 ジャンル</h3>
              <ul style={{ listStyle: 'none', padding: 0, marginTop: '15px' }}>
                <li onClick={() => setSelectedGenre(null)} style={{ cursor: 'pointer', color: !selectedGenre ? '#d32f2f' : '#555', marginBottom: '12px', fontWeight: !selectedGenre ? 'bold' : 'normal', padding: '5px 0' }}>すべて表示</li>
                {existingGenres.map(g => (
                  <li key={g} onClick={() => setSelectedGenre(g)} style={{ cursor: 'pointer', color: selectedGenre === g ? '#d32f2f' : '#555', marginBottom: '12px', fontWeight: selectedGenre === g ? 'bold' : 'normal', padding: '5px 0' }}>{g}</li>
                ))}
              </ul>
            </aside>
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
                <h2 style={{ margin: 0, fontSize: '24px' }}>技術ブログ</h2>
                <button onClick={() => setView('blog_write')} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '12px 28px', borderRadius: '30px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', boxShadow: '0 4px 10px rgba(0,197,142,0.2)' }}>＋ 記事を書く</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '25px' }}>
                {blogArticles.filter(a => !selectedGenre || a.genre === selectedGenre).map(a => (
                  <article key={a.id} onClick={() => { setActiveArticle(a); setView('blog_read'); }} style={{ backgroundColor: '#fff', borderRadius: '18px', overflow: 'hidden', cursor: 'pointer', border: '1px solid #eee', transition: '0.2s', boxShadow: '0 3px 8px rgba(0,0,0,0.03)' }}>
                    <div style={{ height: '170px', backgroundColor: '#eee' }}>{a.image_url && <img src={a.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                    <div style={{ padding: '20px' }}>
                      <span style={{ fontSize: '11px', backgroundColor: '#f3eef7', color: '#5a3d8a', padding: '4px 10px', borderRadius: '5px', fontWeight: 'bold' }}>{a.genre}</span>
                      <h4 style={{ margin: '12px 0', fontSize: '19px', lineHeight: '1.4', height: '52px', overflow: 'hidden' }}>{a.title}</h4>
                      <div style={{ fontSize: '12px', color: '#999', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{a.author_name}</span>
                        <span>{new Date(a.created_at).toLocaleDateString()}</span>
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
          <article style={{ maxWidth: '850px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '25px', overflow: 'hidden', border: '1px solid #eee', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
            {activeArticle.image_url && <img src={activeArticle.image_url} style={{ width: '100%', maxHeight: '450px', objectFit: 'cover' }} />}
            <div style={{ padding: '50px' }}>
              <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '30px' }}>← 一覧に戻る</button>
              <div style={{ fontSize: '14px', color: '#5a3d8a', fontWeight: 'bold', marginBottom: '10px' }}>📁 {activeArticle.genre}</div>
              <h1 style={{ fontSize: '38px', margin: '0 0 30px 0', lineHeight: '1.2', color: '#111' }}>{activeArticle.title}</h1>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '45px', paddingBottom: '25px', borderBottom: '1px solid #eee' }}>
                <img src={activeArticle.author_avatar || 'https://via.placeholder.com/45'} style={{ width: '45px', height: '45px', borderRadius: '50%' }} />
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{activeArticle.author_name}</div>
                  <div style={{ fontSize: '13px', color: '#888' }}>{new Date(activeArticle.created_at).toLocaleString()}</div>
                </div>
                <button onClick={() => handleLike(activeArticle)} style={{ backgroundColor: likedPosts.includes(activeArticle.id) ? '#ff4b5c' : '#fff', border: '1px solid #ff4b5c', color: likedPosts.includes(activeArticle.id) ? '#fff' : '#ff4b5c', padding: '10px 25px', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  ❤️ {activeArticle.likes || 0}
                </button>
                {isAdmin && <button onClick={() => handleDeletePost(activeArticle.id)} style={{ border: '1px solid #d32f2f', color: '#d32f2f', background: 'none', padding: '10px 20px', borderRadius: '30px', cursor: 'pointer', marginLeft: '10px' }}>🗑️ 削除</button>}
              </div>
              
              <div style={{ fontSize: '18px', lineHeight: '2.0', color: '#333' }}>{renderContent(activeArticle.content)}</div>
            </div>
          </article>
        )}

        {/* ブログ執筆画面 */}
        {view === 'blog_write' && (
          <div style={{ maxWidth: '900px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '25px', border: '1px solid #ddd' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', marginBottom: '20px' }}>← キャンセル</button>
            
            {/* 表紙画像 */}
            <div style={{ marginBottom: '30px', height: '250px', border: '2px dashed #ddd', borderRadius: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', position: 'relative', backgroundColor: '#fafafa' }}>
              {coverPreview ? (
                <img src={coverPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <>
                  <span style={{ fontSize: '40px', marginBottom: '10px' }}>🖼️</span>
                  <span style={{ color: '#888', fontWeight: 'bold' }}>記事の表紙画像を選択（任意）</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={async (e) => { 
                const f = e.target.files?.[0]; 
                if (f) {
                  setLoading(true);
                  const res = await uploadFile(f);
                  if (res) setCoverPreview(res.url);
                  setLoading(false);
                }
              }} style={{ position: 'absolute', opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
            </div>

            {/* ジャンル設定 */}
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px', color: '#5a3d8a' }}>📁 カテゴリ選択</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {!isNewGenre ? (
                  <select value={genre} onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '12px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '15px' }}>
                    <option value="未分類">未分類</option>{existingGenres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="新しいカテゴリ名を入力..." onChange={(e) => setGenre(e.target.value)} style={{ flexGrow: 1, padding: '12px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '15px' }} />
                )}
                <button onClick={() => setIsNewGenre(!isNewGenre)} style={{ padding: '0 20px', borderRadius: '10px', border: '1px solid #ccc', background: '#f9f9f9', cursor: 'pointer', fontWeight: 'bold' }}>{isNewGenre ? '選択に戻る' : '新規作成'}</button>
              </div>
            </div>
            
            {/* 本文ツールバー */}
            <div style={{ backgroundColor: '#f3eef7', padding: '15px', borderRadius: '12px', marginBottom: '15px', border: '1px solid #e0d5ed' }}>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                <label style={{ cursor: 'pointer', backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 25px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(90,61,138,0.2)' }}>
                  📸 画像・ファイルを本文に挿入
                  <input type="file" onChange={handleFileInsert} style={{ display: 'none' }} />
                </label>
                <span style={{ fontSize: '12px', color: '#5a3d8a' }}>※カーソルがある位置に自動的に貼り付けられます</span>
              </div>
            </div>

            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトルを入力..." style={{ width: '100%', fontSize: '32px', fontWeight: 'bold', border: 'none', borderBottom: '2px solid #eee', marginBottom: '30px', padding: '10px 0', outline: 'none' }} />
            
            <textarea 
              ref={textareaRef} 
              value={content} 
              onChange={(e) => setContent(e.target.value)} 
              placeholder="内容を自由に記述してください..." 
              style={{ width: '100%', minHeight: '450px', border: '1px solid #eee', padding: '20px', outline: 'none', fontSize: '17px', lineHeight: '1.7', borderRadius: '15px' }} 
            />

            <button onClick={handleBlogSubmit} disabled={loading} style={{ width: '100%', backgroundColor: '#00c58e', color: '#fff', padding: '20px', border: 'none', borderRadius: '15px', fontSize: '20px', fontWeight: 'bold', cursor: 'pointer', marginTop: '40px', boxShadow: '0 6px 15px rgba(0,197,142,0.3)' }}>
              {loading ? "アップロード中..." : "記事を公開する"}
            </button>
          </div>
        )}

        {/* ユーザー設定 */}
        {view === 'profile' && (
          <section style={{ maxWidth: '500px', margin: '0 auto', backgroundColor: '#fff', padding: '40px', borderRadius: '25px', border: '1px solid #ddd', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
            <h2 style={{ color: '#5a3d8a', marginBottom: '30px', textAlign: 'center' }}>ユーザー設定</h2>
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>表示名</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ccc', fontSize: '16px' }} />
            </div>
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '10px' }}>アイコン変更</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <img src={avatarPreview || 'https://via.placeholder.com/70'} style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #5a3d8a' }} />
                <input type="file" accept="image/*" onChange={(e) => { 
                  const f = e.target.files?.[0]; 
                  if (f) { setAvatarFile(f); setAvatarPreview(URL.createObjectURL(f)); } 
                }} style={{ fontSize: '13px' }} />
              </div>
            </div>
            <div style={{ padding: '20px', backgroundColor: '#fff5f5', borderRadius: '15px', marginBottom: '30px', border: '1px solid #ffebeb' }}>
              <label style={{ fontSize: '13px', color: '#d32f2f', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>🔑 管理者用パスワード</label>
              <input type="password" value={adminPassInput} onChange={(e) => setAdminPassInput(e.target.value)} placeholder="削除権限が必要な場合のみ入力" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ffcccc', fontSize: '15px' }} />
            </div>
            <button onClick={saveProfile} disabled={loading} style={{ width: '100%', backgroundColor: '#5a3d8a', color: '#fff', padding: '15px', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
              {loading ? '保存中...' : '設定を保存する'}
            </button>
          </section>
        )}

      </main>
    </div>
  );
}
