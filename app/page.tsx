"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase接続設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ★ここにアップロードしたロゴのURLを貼り付けてください
const LOGO_URL = "https://wkvetwjywdkwairqztsb.supabase.co/storage/v1/object/public/images/0.7302238554901188.png";

export default function MunakataBlog() {
  const [view, setView] = useState<'bbs' | 'wiki' | 'profile'>('bbs');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // プロフィール用ステート（ブラウザに保存）
  const [profileName, setProfileName] = useState('名無しさん');
  const [profileAvatar, setProfileAvatar] = useState('');
  
  // アイコン画像アップロード用
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState('');

  // 掲示板入力用
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');

  useEffect(() => {
    // サイトを開いた時に、保存されているプロフィールを読み込む
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

  // 画像をSupabaseにアップロードしてURLを返す共通関数
  async function uploadImage(file: File) {
    const fileName = `${Math.random()}.${file.name.split('.').pop()}`;
    const { data } = await supabase.storage.from('images').upload(fileName, file);
    if (data) {
      const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
      return pub.publicUrl;
    }
    return '';
  }

  // プロフィールの保存（画像アップロード込み）
  async function saveProfile() {
    setLoading(true);
    let newAvatarUrl = profileAvatar;

    // 新しい画像が選択されていればアップロード
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
    setView('bbs'); // 保存したら自動でブログ画面に戻す
    setLoading(false);
  }

  // 新規スレッド投稿
  async function handleMainSubmit() {
    if (!content) return;
    setLoading(true);
    let imageUrl = imageFile ? await uploadImage(imageFile) : '';
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

  // 返信投稿
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
          <img src={LOGO_URL} alt="Logo" style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid #5a3d8a', objectFit: 'cover' }} />
          <div>
            <h1 style={{ margin: 0, color: '#5a3d8a', fontSize: '26px', fontWeight: 'bold' }}>MunakataEPC_BLOG</h1>
            <span style={{ fontSize: '13px', color: '#666' }}>〜 公式交流ブログ 〜</span>
          </div>
        </div>
        
        {/* 右上のプロフィールボタン */}
        <div 
          onClick={() => setView('profile')} 
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '8px 15px', backgroundColor: '#f3eef7', borderRadius: '30px', border: '1px solid #dcd0ea', transition: '0.2s' }}
          title="プロフィールを設定する"
        >
          <img src={profileAvatar || 'https://via.placeholder.com/35?text=No+Img'} style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #ccc' }} />
          <span style={{ fontWeight: 'bold', color: '#5a3d8a', fontSize: '15px' }}>{profileName}</span>
          <span style={{ fontSize: '18px' }}>⚙️</span>
        </div>
      </header>

      {/* ナビゲーション（設定ボタンは右上に移動したため削除） */}
      <nav style={{ padding: '20px 40px', display: 'flex', gap: '15px' }}>
        <button onClick={() => setView('bbs')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view === 'bbs' ? '#5a3d8a' : '#eee', color: view === 'bbs' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>BLOG</button>
        <button onClick={() => setView('wiki')} style={{ padding: '8px 25px', borderRadius: '20px', border: 'none', backgroundColor: view === 'wiki' ? '#5a3d8a' : '#eee', color: view === 'wiki' ? '#fff' : '#333', cursor: 'pointer', fontWeight: 'bold' }}>Wiki</button>
      </nav>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 20px' }}>
        
        {/* プロフィール設定画面 */}
        {view === 'profile' && (
          <section style={{ backgroundColor: '#fff', padding: '40px', borderRadius: '15px', border: '1px solid #ddd', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
            <h2 style={{ color: '#5a3d8a', marginTop: 0 }}>⚙️ プロフィールの設定</h2>
            <p style={{ color: '#666', fontSize: '14px' }}>ここで設定した名前とアイコンが、ブログでの書き込み時に表示されます。</p>
            
            <div style={{ marginBottom: '20px', marginTop: '30px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>表示名</label>
              <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="例：ムナカタ" style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '16px', color: '#333' }} />
            </div>
            
            <div style={{ marginBottom: '30px' }}>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>アイコン画像</label>
              
              {/* ファイル選択に変更 */}
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setAvatarFile(file);
                    setAvatarPreview(URL.createObjectURL(file)); // プレビュー用URLを生成
                  }
                }} 
                style={{ marginBottom: '15px', fontSize: '15px' }}
              />
              
              {/* 現在の画像、または新しく選んだ画像のプレビューを表示 */}
              {(avatarPreview || profileAvatar) && (
                <div style={{ marginTop: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '5px' }}>プレビュー:</span>
                  <img src={avatarPreview || profileAvatar} alt="プレビュー" style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee' }} />
                </div>
              )}
            </div>
            
            <button onClick={saveProfile} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '12px 40px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
              {loading ? '保存中...' : '設定を保存する'}
            </button>
          </section>
        )}

        {/* BLOG（掲示板）画面 */}
        {view === 'bbs' && (
          <div>
            <section style={{ backgroundColor: '#f3eef7', padding: '25px', borderRadius: '15px', border: '1px solid #dcd0ea', marginBottom: '40px' }}>
              <h2 style={{ fontSize: '18px', color: '#5a3d8a', marginTop: 0 }}>🆕 BLOG記事を書く</h2>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル（任意）" style={{ width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc', color: '#333' }} />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="本文" style={{ width: '100%', height: '100px', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: '1px solid #ccc', color: '#333' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <input type="file" onChange={(e) => setImageFile(e.target.files?.[0] || null)} style={{ fontSize: '14px' }} />
                <button onClick={handleMainSubmit} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>投稿する</button>
              </div>
            </section>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
              {mainThreads.map(thread => (
                <article key={thread.id} style={{ backgroundColor: '#fff', border: '1px solid #ddd', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  
                  <div style={{ backgroundColor: '#f8f5fb', padding: '15px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <img src={thread.author_avatar || 'https://via.placeholder.com/50?text=No+Img'} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #eee' }} />
                      <div>
                        <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#555' }}>{thread.author_name || '名無しさん'}</span>
                        <h3 style={{ margin: '5px 0 0 0', color: '#b91c1c', fontSize: '18px' }}>{thread.title || '無題'}</h3>
                      </div>
                    </div>
                    <small style={{ color: '#888' }}>{new Date(thread.created_at).toLocaleString('ja-JP')}</small>
                  </div>

                  <div style={{ padding: '20px' }}>
                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', margin: 0, color: '#333' }}>{thread.content}</p>
                    {thread.image_url && <img src={thread.image_url} alt="Thread image" style={{ maxWidth: '100%', maxHeight: '400px', marginTop: '15px', borderRadius: '8px', display: 'block' }} />}
                    <button onClick={() => setReplyTargetId(replyTargetId === thread.id ? null : thread.id)} style={{ marginTop: '15px', background: 'none', border: '1px solid #5a3d8a', color: '#5a3d8a', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer', fontSize: '14px' }}>💬 返信する</button>
                  </div>

                  <div style={{ backgroundColor: '#fafafa', borderTop: '1px solid #eee' }}>
                    {getReplies(thread.id).map((reply) => (
                      <div key={reply.id} style={{ padding: '15px 20px 15px 40px', borderBottom: '1px solid #f0f0f0', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '20px', top: '0', bottom: '0', width: '2px', backgroundColor: '#dcd0ea' }}></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          <img src={reply.author_avatar || 'https://via.placeholder.com/30?text=No+Img'} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#555' }}>{reply.author_name || '名無しさん'}</span>
                          <span style={{ fontSize: '12px', color: '#999' }}>{new Date(reply.created_at).toLocaleString('ja-JP')}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '15px', lineHeight: '1.5', color: '#333' }}>{reply.content}</p>
                      </div>
                    ))}

                    {replyTargetId === thread.id && (
                      <div style={{ padding: '20px', backgroundColor: '#fff', borderTop: '2px solid #5a3d8a' }}>
                        <textarea value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder={`${profileName} として返信...`} style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '5px', border: '1px solid #ccc', marginBottom: '10px', color: '#333' }} />
                        <div style={{ textAlign: 'right' }}>
                          <button onClick={() => handleReplySubmit(thread.id)} disabled={loading} style={{ backgroundColor: '#5a3d8a', color: '#fff', padding: '8px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>書き込む</button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {view === 'wiki' && (
          <div style={{ textAlign: 'center', padding: '100px', color: '#888' }}>Wiki画面は準備中です</div>
        )}

      </main>
    </div>
  );
}
