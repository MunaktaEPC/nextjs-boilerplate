"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase接続設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ★ ご提示いただいた画像リンクをロゴに設定しました
const LOGO_URL = "https://wkvetwjywdkwairqztsb.supabase.co/storage/v1/object/public/images/0.7302238554901188.png";

export default function MunakataBbsAndBlog() {
  const [view, setView] = useState<'bbs' | 'blog' | 'profile'>('bbs');
  const [posts, setPosts] = useState<any[]>([]);
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
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

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
    if (data) setPosts(data);
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
    setAvatarFile(null);
    setAvatarPreview('');
    alert("プロフィールを保存しました！");
    setView('bbs');
    setLoading(false);
  }

  async function handlePostSubmit() {
    if (!content) return;
    setLoading(true);
    let imageUrl = imageFile ? await uploadImage(imageFile) : '';
    // postsテーブルに投稿。ブログか掲示板かを識別するタグ（category）を入れることも可能ですが、
    // 今はシンプルに全ての投稿を掲示板（bbs）として扱います。
    await supabase.from('posts').insert([{ 
      title, 
      content, 
      image_url: imageUrl,
      author_name: profileName,
      author_avatar: profileAvatar
    }]);
    setTitle(''); setContent(''); setImageFile(null);
    fetchData();
    setLoading(false);
  }

  async function handleReplySubmit(parentId: string) {
    if (!replyContent) return;
    setLoading(true);
    await supabase.from('posts').insert([{ 
      content: replyContent, 
      parent_id: parentId,
      author_name: profileName,
      author_avatar: profileAvatar
    }]);
    setReplyContent(''); setReplyTargetId(null);
    fetchData();
    setLoading(false);
  }

  const mainThreads = posts.filter(p => !p.parent_id);
  const getReplies = (parentId: string) => posts.filter(p => p.parent_id === parentId).reverse();

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
        
        {/* 右上のプロフィール */}
        <div onClick={() => setView('profile')} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 15px', backgroundColor: '#f3eef7', borderRadius: '30px', border: '1px solid #dcd0ea' }}>
          <img src={profileAvatar || 'https://via.placeholder.com/35?text=Img'} style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
          <span style={{ fontWeight: 'bold', color: '#5a3d8a' }}>{profileName}</span>
          <span>⚙️</span>
        </div>
      </header>

      {/* ナビゲーション：掲示板とブログに変更 */}
      <nav style={{ padding: '20px 40px', display: 'flex', gap: '15px' }}>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view === 'bbs' ? '#5a3d8a' : '#eee', color: view === 'bbs' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>掲示板</button>
        <button onClick={() => setView('blog')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view === 'blog' ? '#5a3d8a' : '#eee', color: view === 'blog' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>ブログ</button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px' }}>
        
        {/* プロフィール設定 */}
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

        {/* 掲示板画面（スレッド形式） */}
        {view === 'bbs' && (
          <div>
            <section style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', border: '1px solid #dcd0ea', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', color: '#5a3d8a', marginTop: 0 }}>💬 新しい掲示板スレッドを作成</h2>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文" style={{ width: '100%', height: '100px', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <input type="file" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                <button onClick={handlePostSubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>投稿する</button>
              </div>
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {mainThreads.map(thread => (
                <article key={thread.id} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
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
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{thread.content}</p>
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
                        <p style={{ margin: 0, fontSize: '14px' }}>{reply.content}</p>
                      </div>
                    ))}
                    {replyTargetId === thread.id && (
                      <div style={{ padding: '20px', backgroundColor: '#fff', borderTop: '2px solid #5a3d8a' }}>
                        <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="返信を書く..." style={{ width: '100%', height: '70px', padding: '10px', marginBottom: '10px' }} />
                        <button onClick={() => handleReplySubmit(thread.id)} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '5px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>返信を送信</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {/* ブログ画面（記事リスト形式のイメージ） */}
        {view === 'blog' && (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <h2 style={{ color: '#5a3d8a' }}>🖋️ オフィシャルブログ</h2>
            <p style={{ color: '#666' }}>ここでは管理人の最新記事が公開されます。（準備中）</p>
            <div style={{ marginTop: '30px', display: 'grid', gap: '20px' }}>
              {/* ブログ的なカードデザインのサンプル */}
              <div style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '10px', padding: '20px', textAlign: 'left' }}>
                <h3 style={{ color: '#b91c1c' }}>MunakataEPC_BLOGへようこそ！</h3>
                <p style={{ fontSize: '14px', color: '#444' }}>サイトのデザインを大幅にアップデートしました。掲示板での交流を楽しんでください。</p>
                <small style={{ color: '#aaa' }}>2024.03.20</small>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
