"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function MunakataBBS() {
  const [view, setView] = useState<'bbs' | 'wiki'>('bbs');
  const [posts, setPosts] = useState<any[]>([]);
  const [wikis, setWikis] = useState<any[]>([]);
  
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchData(); }, [view]);

  async function fetchData() {
    if (view === 'bbs') {
      const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false });
      if (data) setPosts(data);
    } else {
      const { data } = await supabase.from('wiki_pages').select('*').order('created_at', { ascending: false });
      if (data) setWikis(data);
    }
  }

  async function handleBbsSubmit() {
    if (!content) return;
    setLoading(true);
    let imageUrl = '';
    if (imageFile) {
      const fileName = `${Math.random()}.${imageFile.name.split('.').pop()}`;
      const { data } = await supabase.storage.from('images').upload(fileName, imageFile);
      if (data) {
        const { data: pub } = supabase.storage.from('images').getPublicUrl(fileName);
        imageUrl = pub.publicUrl;
      }
    }
    await supabase.from('posts').insert([{ title, content, image_url: imageUrl }]);
    setTitle(''); setContent(''); setImageFile(null);
    fetchData();
    setLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#fff', color: '#333', fontFamily: '"Helvetica Neue", Arial, "Hiragino Kaku Gothic ProN", sans-serif' }}>
      
      {/* ヘッダー：水色のラインと大きなロゴ */}
      <header style={{ borderBottom: '3px solid #8ecae6', padding: '20px 40px', marginBottom: '20px' }}>
        <h1 style={{ color: '#219ebc', fontSize: '32px', margin: 0, fontWeight: 'bold' }}>
          MunakataEPC_VLOG <span style={{ fontSize: '16px', color: '#888', fontWeight: 'normal' }}>〜 ここはVLOG交流場です 〜</span>
        </h1>
      </header>

      {/* ナビゲーション */}
      <nav style={{ padding: '0 40px 20px', display: 'flex', gap: '10px' }}>
        <button onClick={() => setView('bbs')} style={{ padding: '10px 20px', backgroundColor: view === 'bbs' ? '#219ebc' : '#eee', color: view === 'bbs' ? '#fff' : '#333', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>掲示板トップ</button>
        <button onClick={() => setView('wiki')} style={{ padding: '10px 20px', backgroundColor: view === 'wiki' ? '#219ebc' : '#eee', color: view === 'wiki' ? '#fff' : '#333', border: 'none', borderRadius: '5px', cursor: 'pointer' }}>技術Wiki</button>
      </nav>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
        {view === 'bbs' ? (
          <div>
            {/* 新規スレッド作成エリア */}
            <section style={{ marginBottom: '40px', borderBottom: '1px solid #eee', paddingBottom: '20px' }}>
              <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>新しくスレッドを立てたい方はこちら。</h2>
              <div style={{ backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '10px', border: '1px solid #ddd' }}>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="スレッドタイトル" style={{ width: '100%', padding: '12px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="内容" style={{ width: '100%', height: '100px', padding: '12px', marginBottom: '10px', border: '1px solid #ccc', borderRadius: '4px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <input type="file" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                  <button onClick={handleBbsSubmit} disabled={loading} style={{ backgroundColor: '#219ebc', color: '#fff', padding: '10px 30px', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>スレッドを作成</button>
                </div>
              </div>
            </section>

            {/* メインの2カラム */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '40px' }}>
              
              {/* 左：スレッド一覧 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {posts.map(post => (
                  <div key={post.id} style={{ border: '2px solid #ddd', borderRadius: '8px', padding: '20px', display: 'flex', gap: '20px', backgroundColor: '#fff' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ color: '#b91c1c', fontSize: '20px', marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
                        {post.title || '無題のスレッド'}
                      </h3>
                      <p style={{ fontSize: '15px', color: '#555', lineHeight: '1.6' }}>{post.content}</p>
                      {post.image_url && <img src={post.image_url} alt="upload" style={{ maxWidth: '200px', marginTop: '10px', borderRadius: '5px' }} />}
                    </div>
                    {/* アイコン風スペース */}
                    <div style={{ width: '100px', textAlign: 'center' }}>
                      <div style={{ width: '80px', height: '80px', backgroundColor: '#eee', borderRadius: '50%', margin: '0 auto 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px' }}>👤</div>
                      <small style={{ color: '#888' }}>ムナカタさん</small>
                    </div>
                  </div>
                ))}
              </div>

              {/* 右：サイドバー */}
              <aside>
                <h3 style={{ borderBottom: '2px solid #219ebc', paddingBottom: '5px', marginBottom: '15px' }}>掲示板一覧</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {posts.slice(0, 5).map(post => (
                    <div key={post.id} style={{ display: 'flex', gap: '10px', fontSize: '13px', borderBottom: '1px dashed #ccc', paddingBottom: '10px' }}>
                      <div style={{ width: '40px', height: '40px', backgroundColor: '#eee', borderRadius: '5px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🎥</div>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#219ebc' }}>{post.title || '無題'}</div>
                        <div style={{ color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '200px' }}>{post.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </aside>

            </div>
          </div>
        ) : (
          /* Wikiビューはそのまま維持 */
          <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '10px' }}>
            <h2 style={{ color: '#28a745' }}>技術Wiki</h2>
            <p>ここに技術情報を蓄積します。</p>
            {/* Wikiのコンテンツをここに表示 */}
          </div>
        )}
      </main>
    </div>
  );
}
