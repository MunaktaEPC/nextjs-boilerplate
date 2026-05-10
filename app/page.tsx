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
  
  // 入力用ステート
  const [content, setContent] = useState('');
  const [wikiTitle, setWikiTitle] = useState('');
  const [wikiBody, setWikiBody] = useState('');
  const [loading, setLoading] = useState(false);

  // データの取得
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

  // 掲示板投稿
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

  // Wiki保存
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f0f2f5', fontFamily: 'sans-serif' }}>
      {/* ナビゲーションバー */}
      <nav style={{ backgroundColor: '#1a1a1a', color: 'white', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '24px' }}>🛡️</span>
          <h1 style={{ margin: 0, fontSize: '20px' }}>技術継承 ARCHIVE</h1>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={() => setView('bbs')}
            style={{ 
              padding: '8px 20px', 
              borderRadius: '6px', 
              border: 'none', 
              cursor: 'pointer', 
              backgroundColor: view === 'bbs' ? '#0070f3' : 'transparent', 
              color: 'white', 
              fontWeight: 'bold' 
            }}
          >
            掲示板
          </button>
          <button 
            onClick={() => setView('wiki')}
            style={{ 
              padding: '8px 20px', 
              borderRadius: '6px', 
              border: 'none', 
              cursor: 'pointer', 
              backgroundColor: view === 'wiki' ? '#0070f3' : 'transparent', 
              color: 'white', 
              fontWeight: 'bold' 
            }}
          >
            技術Wiki
          </button>
        </div>
      </nav>

      {/* メインコンテンツエリア */}
      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '40px 20px' }}>
        
        {view === 'bbs' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: '30px', alignItems: 'flex-start' }}>
            {/* 左側：投稿フォーム */}
            <aside style={{ backgroundColor: 'white', padding: '25px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', position: 'sticky', top: '104px' }}>
              <h3 style={{ marginTop: 0, marginBottom: '20px' }}>💬 雑談・報告</h3>
              <textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="今何してる？"
                style={{ width: '100%', height: '180px', padding: '15px', borderRadius: '10px', border: '1px solid #e1e4e8', fontSize: '16px', marginBottom: '15px', resize: 'none' }}
              />
              <button 
                onClick={handleBbsSubmit} 
                disabled={loading}
                style={{ width: '100%', padding: '14px', backgroundColor: loading ? '#ccc' : '#0070f3', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {loading ? '送信中...' : '投稿する'}
              </button>
            </aside>

            {/* 右側：タイムライン */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {posts.map(post => (
                <div key={post.id} style={{ backgroundColor: 'white', padding: '25px', borderRadius: '16px', border: '1px solid #f0f0f0' }}>
                  <p style={{ margin: '0 0 15px 0', fontSize: '17px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{post.content}</p>
                  <small style={{ color: '#95a5a6' }}>🕒 {new Date(post.created_at).toLocaleString('ja-JP')}</small>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <section style={{ backgroundColor: 'white', padding: '35px', borderRadius: '20px', marginBottom: '40px', borderTop: '6px solid #28a745' }}>
              <h3 style={{ marginTop: 0, marginBottom: '25px', fontSize: '24px' }}>📚 Wiki記事執筆</h3>
              <input 
                type="text" 
                value={wikiTitle}
                onChange={(e) => setWikiTitle(e.target.value)}
                placeholder="タイトル"
                style={{ width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #e1e4e8', marginBottom: '20px', fontSize: '20px', fontWeight: 'bold' }}
              />
              <textarea 
                value={wikiBody}
                onChange={(e) => setWikiBody(e.target.value)}
                placeholder="本文..."
                style={{ width: '100%', height: '300px', padding: '15px', borderRadius: '10px', border: '1px solid #e1e4e8', fontSize: '16px', marginBottom: '20px' }}
              />
              <button onClick={handleWikiSubmit} style={{ padding: '14px 40px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>
                Wikiに保存
              </button>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '25px' }}>
              {wikis.map(wiki => (
                <div key={wiki.id} style={{ backgroundColor: 'white', padding: '30px', borderRadius: '18px', borderLeft: '10px solid #28a745', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                  <h4 style={{ margin: '0 0 15px 0', fontSize: '22px' }}>{wiki.title}</h4>
                  <p style={{ color: '#555', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{wiki.body}</p>
                  <small style={{ color: '#999' }}>📅 {new Date(wiki.created_at).toLocaleDateString('ja-JP')}</small>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
