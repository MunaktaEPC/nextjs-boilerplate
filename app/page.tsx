"use client";
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase接続設定
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function TechPortal() {
  const [view, setView] = useState<'bbs' | 'wiki'>('bbs');
  const [posts, setPosts] = useState<any[]>([]);
  const [wikis, setWikis] = useState<any[]>([]);
  
  const [content, setContent] = useState('');
  const [wikiTitle, setWikiTitle] = useState('');
  const [wikiBody, setWikiBody] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      if (view === 'bbs') {
        const { data, error } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) setPosts(data);
      } else {
        const { data, error } = await supabase
          .from('wiki_pages')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        if (data) setWikis(data);
      }
    } catch (err) {
      console.error('Data fetch error:', err);
    }
  };

  useEffect(() => {
    if (supabaseUrl && supabaseAnonKey) {
      fetchData();
    }
  }, [view]);

  const handleBbsSubmit = async () => {
    if (!content || !supabaseUrl) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('posts').insert([{ content }]);
      if (error) throw error;
      setContent('');
      await fetchData();
    } catch (err: any) {
      alert("投稿エラー: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWikiSubmit = async () => {
    if (!wikiTitle || !wikiBody || !supabaseUrl) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('wiki_pages').insert([{ title: wikiTitle, body: wikiBody }]);
      if (error) throw error;
      setWikiTitle('');
      setWikiBody('');
      await fetchData();
    } catch (err: any) {
      alert("Wiki保存エラー: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5', color: '#1a1a1a', fontFamily: 'sans-serif' }}>
      {/* ナビゲーションバー */}
      <nav style={{ backgroundColor: '#1a1a1a', color: 'white', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '24px' }}>🎥</span>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 'bold' }}>MunakataEPC_VLOG</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => setView('bbs')}
            style={{ 
              padding: '8px 24px', 
              borderRadius: '8px', 
              border: 'none', 
              cursor: 'pointer', 
              backgroundColor: view === 'bbs' ? '#0070f3' : '#333', 
              color: 'white', 
              fontWeight: 'bold',
              transition: '0.2s'
            }}
          >
            掲示板
          </button>
          <button 
            onClick={() => setView('wiki')}
            style={{ 
              padding: '8px 24px', 
              borderRadius: '8px', 
              border: 'none', 
              cursor: 'pointer', 
              backgroundColor: view === 'wiki' ? '#0070f3' : '#333', 
              color: 'white', 
              fontWeight: 'bold',
              transition: '0.2s'
            }}
          >
            Wiki
          </button>
        </div>
      </nav>

      {/* メインエリア */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px' }}>
        
        {view === 'bbs' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '40px', alignItems: 'flex-start' }}>
            {/* 左側：投稿フォーム */}
            <aside style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 25px rgba(0,0,0,0.1)', position: 'sticky', top: '104px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px', color: '#1a1a1a' }}>💬 クイック投稿</h3>
              <textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="VLOGの感想やメモをどうぞ！"
                style={{ width: '100%', height: '200px', padding: '15px', borderRadius: '12px', border: '2px solid #eee', fontSize: '16px', color: '#333', marginBottom: '20px', resize: 'none', boxSizing: 'border-box' }}
              />
              <button 
                onClick={handleBbsSubmit} 
                disabled={loading}
                style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#ccc' : '#0070f3', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer' }}
              >
                {loading ? '送信中...' : '送信する'}
              </button>
            </aside>

            {/* 右側：タイムライン */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
              {posts.map(post => (
                <div key={post.id} style={{ backgroundColor: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e1e4e8', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                  <p style={{ margin: '0 0 20px 0', fontSize: '18px', lineHeight: '1.8', color: '#1a1a1a', whiteSpace: 'pre-wrap' }}>{post.content}</p>
                  <div style={{ textAlign: 'right' }}>
                    <small style={{ color: '#888', fontWeight: '500' }}>🕒 {new Date(post.created_at).toLocaleString('ja-JP')}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Wikiビュー */
          <div>
            <section style={{ backgroundColor: 'white', padding: '40px', borderRadius: '24px', marginBottom: '40px', boxShadow: '0 4px 25px rgba(0,0,0,0.1)' }}>
              <h3 style={{ marginTop: 0, marginBottom: '25px', fontSize: '26px', color: '#1a1a1a' }}>📝 アーカイブ作成</h3>
              <input 
                type="text" 
                value={wikiTitle}
                onChange={(e) => setWikiTitle(e.target.value)}
                placeholder="タイトルを入力..."
                style={{ width: '100%', padding: '18px', borderRadius: '12px', border: '2px solid #eee', marginBottom: '25px', fontSize: '20px', fontWeight: 'bold', color: '#1a1a1a', boxSizing: 'border-box' }}
              />
              <textarea 
                value={wikiBody}
                onChange={(e) => setWikiBody(e.target.value)}
                placeholder="詳細な記録をここに..."
                style={{ width: '100%', height: '350px', padding: '18px', borderRadius: '12px', border: '2px solid #eee', fontSize: '17px', color: '#333', marginBottom: '25px', lineHeight: '1.8', boxSizing: 'border-box' }}
              />
              <div style={{ textAlign: 'right' }}>
                <button onClick={handleWikiSubmit} style={{ padding: '16px 50px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '18px', cursor: 'pointer' }}>
                  Wikiを公開
                </button>
              </div>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '30px' }}>
              {wikis.map(wiki => (
                <div key={wiki.id} style={{ backgroundColor: 'white', padding: '35px', borderRadius: '24px', borderTop: '8px solid #28a745', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '24px', color: '#1a1a1a' }}>{wiki.title}</h4>
                  <p style={{ color: '#444', fontSize: '17px', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{wiki.body}</p>
                  <div style={{ marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #f0f0f0', color: '#999' }}>
                    <small>📅 {new Date(wiki.created_at).toLocaleDateString('ja-JP')}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
