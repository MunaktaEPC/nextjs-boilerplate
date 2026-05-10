"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase接続設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const LOGO_URL = "https://wkvetwjywdkwairqztsb.supabase.co/storage/v1/object/public/images/0.7302238554901188.png";

// ★追加：TypeScriptに「投稿データ」の形を教えるための設計図
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
  const [view, setView] = useState<'bbs' | 'blog_list' | 'blog_write' | 'blog_read' | 'profile'>('bbs');
  const [posts, setPosts] = useState<Post[]>([]); // ★ any[] から Post[] に変更
  const [loading, setLoading] = useState(false);
  
  // プロフィール用
  const [profileName, setProfileName] = useState('名無しさん');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  // 入力用
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState(''); 
  const [genre, setGenre] = useState('未分類');
  
  // 返信用
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  // ブログ閲覧用
  const [activeArticle, setActiveArticle] = useState<Post | null>(null); // ★ any から Post に変更
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [insertingImage, setInsertingImage] = useState(false);

  useEffect(() => {
    const savedName = localStorage.getItem('munakata_name');
    const savedAvatar = localStorage.getItem('munakata_avatar');
    if (savedName) setProfileName(savedName);
    if (savedAvatar) setProfileAvatar(savedAvatar);
    fetchData();
  }, [view]);

  async function fetchData() {
    const { data } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setPosts(data as Post[]); // ★ 取得したデータを Post 型として扱うよう明示
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
    setAvatarFile(null); setAvatarPreview('');
    alert("プロフィールを保存しました！");
    setView('bbs');
    setLoading(false);
  }

  async function handleBbsSubmit() {
    if (!content) return;
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
    // ジャンルが空欄の場合は「未分類」にする
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
      setContent(prev => prev + `\n![画像](${url})\n`);
    }
    setInsertingImage(false);
    e.target.value = '';
  }

  async function handleReplySubmit(parentId: string) {
    if (!replyContent) return;
    setLoading(true);
    await supabase.from('posts').insert([{ 
      content: replyContent, parent_id: parentId, author_name: profileName, author_avatar: profileAvatar, category: 'bbs'
    }]);
    setReplyContent(''); setReplyTargetId(null);
    fetchData(); setLoading(false);
  }

  // データの振り分け
  const mainThreads = posts.filter(p => !p.parent_id);
  const bbsThreads = mainThreads.filter(p => p.category !== 'blog');
  const blogArticles = mainThreads.filter(p => p.category === 'blog');
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).reverse();

  // 投稿された記事から、自動で階層化されたジャンル一覧を生成する機能
  const dynamicGenres = useMemo(() => {
    const genreSet = new Set<string>();
    
    blogArticles.forEach(article => {
      if (article.genre && article.genre !== '未分類') {
        const parts = article.genre.split('/');
        let currentPath = '';
        // ★ エラー箇所修正：(part: string) と明示的に文字であることをTypeScriptに教えました
        parts.forEach((part: string) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          genreSet.add(currentPath);
        });
      }
    });

    const sortedPaths = Array.from(genreSet).sort();
    const result = [
      { id: '未分類', label: '未分類', level: 0 },
      ...sortedPaths.map((path: string) => {
        const parts = path.split('/');
        return {
          id: path,
          label: parts[parts.length - 1],
          level: parts.length - 1
        };
      })
    ];
    return result;
  }, [blogArticles]);

  const renderContent = (text: string) => {
    const parts = text.split(/(!\[.*?\]\(.*?\))/g);
    // ★ ここも念のため (part: string, index: number) と型をつけました
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <img src={LOGO_URL} alt="Logo" style={{ width: '55px', height: '55px', borderRadius: '50%', border: '2px solid #5a3d8a', objectFit: 'cover' }} />
          <div>
            <h1 style={{ margin: 0, color: '#5a3d8a', fontSize: '26px', fontWeight: 'bold' }}>MunakataEPC_BLOG</h1>
            <span style={{ fontSize: '13px', color: '#666' }}>〜 公式交流サイト 〜</span>
          </div>
        </div>
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 15px', backgroundColor: '#f3eef7', borderRadius: '30px', border: '1px solid #dcd0ea' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/35?text=Img'} style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', color: '#5a3d8a' }}>{profileName}</span>
          <span>⚙️</span>
        </div>
      </header>

      {/* ナビゲーション */}
      <nav style={{ padding: '20px 40px', display: 'flex', gap: '15px', borderBottom: '1px solid #eee', backgroundColor: '#fff' }}>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view === 'bbs' ? '#5a3d8a' : '#eee', color: view === 'bbs' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>💬 掲示板</button>
        <button onClick={() => setView('blog_list')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view.startsWith('blog') ? '#5a3d8a' : '#eee', color: view.startsWith('blog') ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>🖋️ ブログ</button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '30px 20px' }}>
        
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
            <button onClick={saveProfile} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 40px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>保存する</button>
          </section>
        )}

        {/* ================= 掲示板画面 ================= */}
        {view === 'bbs' && (
          <div>
            <section style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', border: '1px solid #dcd0ea', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', color: '#5a3d8a', marginTop: 0 }}>💬 新しい掲示板スレッドを作成</h2>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文" style={{ width: '100%', height: '100px', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <input type="file" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                <button onClick={handleBbsSubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>投稿する</button>
              </div>
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {bbsThreads.map(thread => (
                <article key={thread.id} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f8f5fb', padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <img src={thread.author_avatar || 'https://via.placeholder.com/40'} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                      <div>
                        <div style={{ fontSize: '13px', color: '#555', fontWeight: 'bold' }}>{thread.author_name}</div>
                        <h3 style={{ margin: 0, color: '#b91c1c', fontSize: '18px' }}>{thread.title}</h3>
                      </div>
                    </div>
                    <small style={{ color: '#888' }}>{new Date(thread.created_at).toLocaleString('ja-JP')}</small>
                  </div>
                  <div style={{ padding: '20px' }}>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{renderContent(thread.content)}</div>
                    {thread.image_url && <img src={thread.image_url} style={{ maxWidth: '100%', marginTop: '10px', borderRadius: '8px' }} />}
                    <button onClick={() => setReplyTargetId(replyTargetId === thread.id ? null : thread.id)} style={{ marginTop: '15px', color: '#5a3d8a', background: 'none', border: '1px solid #5a3d8a', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer' }}>返信する</button>
                  </div>
                  <div style={{ backgroundColor: '#fafafa' }}>
                    {getReplies(thread.id).map(reply => (
                      <div key={reply.id} style={{ padding: '15px 20px 15px 40px', borderTop: '1px solid #eee', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '20px', top: 0, bottom: 0, width: '2px', backgroundColor: '#dcd0ea' }}></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                          <img src={reply.author_avatar || 'https://via.placeholder.com/24'} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                          <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{reply.author_name}</span>
                        </div>
                        <div style={{ margin: 0, fontSize: '14px', whiteSpace: 'pre-wrap' }}>{renderContent(reply.content)}</div>
                      </div>
                    ))}
                    {replyTargetId === thread.id && (
                      <div style={{ padding: '20px', backgroundColor: '#fff', borderTop: '2px solid #5a3d8a' }}>
                        <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信を書く..." style={{ width: '100%', height: '70px', padding: '10px', marginBottom: '10px' }} />
                        <button onClick={() => handleReplySubmit(thread.id)} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '5px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>送信</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* ================= ブログ機能：記事一覧 ================= */}
        {view === 'blog_list' && (
          <div style={{ display: 'flex', gap: '30px', alignItems: 'flex-start' }}>
            
            {/* 左サイドバー：動的ジャンルツリー */}
            <div style={{ width: '220px', flexShrink: 0, backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '12px', border: '1px solid #eee', position: 'sticky', top: '100px' }}>
              <h3 style={{ fontSize: '16px', color: '#5a3d8a', marginTop: 0, borderBottom: '2px solid #dcd0ea', paddingBottom: '10px', marginBottom: '15px' }}>📁 ジャンル</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '14px', lineHeight: '2.2' }}>
                <li 
                  onClick={() => setSelectedGenre(null)} 
                  style={{ cursor: 'pointer', fontWeight: selectedGenre === null ? 'bold' : 'normal', color: selectedGenre === null ? '#b91c1c' : '#333' }}
                >
                  🌐 全ての記事
                </li>
                {dynamicGenres.filter(g => g.id !== '未分類').map((g) => (
                  <li 
                    key={g.id} 
                    onClick={() => setSelectedGenre(g.id)} 
                    style={{ 
                      cursor: 'pointer', 
                      paddingLeft: `${g.level * 15}px`, 
                      fontWeight: selectedGenre === g.id ? 'bold' : 'normal',
                      color: selectedGenre === g.id ? '#b91c1c' : '#555'
                    }}
                  >
                    {g.level === 0 ? '📂' : '📄'} {g.label}
                  </li>
                ))}
              </ul>
            </div>

            {/* 右メイン：記事一覧 */}
            <div style={{ flexGrow: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ color: '#333', margin: 0 }}>
                  {selectedGenre ? `「${dynamicGenres.find(g => g.id === selectedGenre)?.label}」の記事` : '最新の記事'}
                </h2>
                <button onClick={() => { setTitle(''); setContent(''); setImageFile(null); setCoverPreview(''); setGenre('未分類'); setView('blog_write'); }} style={{ backgroundColor: '#00c58e', color: '#fff', padding: '10px 20px', border: 'none', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                  ＋ 記事を書く
                </button>
              </div>

              <div style={{ display: 'grid', gap: '25px' }}>
                {blogArticles
                  .filter(article => selectedGenre === null || article.genre?.startsWith(selectedGenre))
                  .map(article => (
                  <article key={article.id} onClick={() => { setActiveArticle(article); setView('blog_read'); }} style={{ backgroundColor: '#fff', border: '1px solid #eee', borderRadius: '12px', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column' }}>
                    {article.image_url && (
                      <img src={article.image_url} alt="Cover" style={{ width: '100%', height: '200px', objectFit: 'cover' }} />
                    )}
                    <div style={{ padding: '20px' }}>
                      <div style={{ fontSize: '12px', color: '#fff', backgroundColor: '#5a3d8a', display: 'inline-block', padding: '2px 10px', borderRadius: '10px', marginBottom: '10px' }}>
                        {article.genre || '未分類'}
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
                {blogArticles.filter(a => selectedGenre === null || a.genre?.startsWith(selectedGenre)).length === 0 && (
                  <p style={{ textAlign: 'center', color: '#888', padding: '50px' }}>この記事は見つかりませんでした。</p>
                )}
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

            {/* カバー画像設定 */}
            <div style={{ marginBottom: '20px', position: 'relative', backgroundColor: '#f9f9f9', border: '1px dashed #ccc', borderRadius: '10px', height: coverPreview ? 'auto' : '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {coverPreview ? <img src={coverPreview} style={{ width: '100%', maxHeight: '400px', objectFit: 'cover' }} /> : <span style={{ color: '#888' }}>📷 トップ用カバー画像を追加（任意）</span>}
              <input type="file" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) { setImageFile(file); setCoverPreview(URL.createObjectURL(file)); }
              }} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
            </div>

            {/* ★自由入力ジャンル選択（サジェスト付き） */}
            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold' }}>📁 ジャンル:</span>
              <input 
                type="text" 
                list="genre-list"
                value={genre} 
                onChange={(e) => setGenre(e.target.value)} 
                placeholder="例: hard/board/kicker"
                style={{ padding: '8px', borderRadius: '5px', border: '1px solid #ccc', flexGrow: 1, maxWidth: '300px' }} 
              />
              <datalist id="genre-list">
                {dynamicGenres.map(g => <option key={g.id} value={g.id} />)}
              </datalist>
              <span style={{ fontSize: '12px', color: '#666' }}>※自由に作成可能。「/」で区切るとフォルダになります。</span>
            </div>

            {/* タイトル */}
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="記事のタイトル" style={{ width: '100%', fontSize: '32px', fontWeight: 'bold', border: 'none', borderBottom: '1px solid #eee', padding: '15px 0', marginBottom: '20px', outline: 'none' }} />

            {/* 本文ツールバー（画像挿入ボタン） */}
            <div style={{ backgroundColor: '#f1f1f1', padding: '10px', borderRadius: '8px', marginBottom: '10px', display: 'flex', gap: '10px' }}>
              <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', color: '#555', backgroundColor: '#fff', padding: '5px 10px', borderRadius: '5px', border: '1px solid #ccc' }}>
                <span>{insertingImage ? '⏳ アップロード中...' : '🖼️ 本文に画像を挿入'}</span>
                <input type="file" accept="image/*" disabled={insertingImage} onChange={handleInsertImageToContent} style={{ display: 'none' }} />
              </label>
              <span style={{ fontSize: '12px', color: '#888', alignSelf: 'center' }}>※画像を選ぶと本文の末尾に挿入されます</span>
            </div>

            {/* 本文 */}
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="ここに本文を書く..." style={{ width: '100%', minHeight: '400px', fontSize: '18px', lineHeight: '1.8', border: 'none', outline: 'none', resize: 'vertical' }} />
          </div>
        )}

        {/* ================= ブログ機能：閲覧画面 ================= */}
        {view === 'blog_read' && activeArticle && (
          <article style={{ backgroundColor: '#fff', padding: '40px 0', borderRadius: '15px', maxWidth: '800px', margin: '0 auto' }}>
            <button onClick={() => setView('blog_list')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '16px', marginBottom: '20px', marginLeft: '20px' }}>← 記事一覧に戻る</button>
            
            {activeArticle.image_url && (
              <img src={activeArticle.image_url} alt="Cover" style={{ width: '100%', maxHeight: '450px', objectFit: 'cover', borderRadius: '10px', marginBottom: '30px' }} />
            )}
            
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

              {/* 本文表示（画像タグをレンダリング） */}
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
