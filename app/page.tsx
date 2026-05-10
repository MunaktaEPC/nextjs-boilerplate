export default function Home() {
  return (
    <div style={{ padding: "50px", fontFamily: "sans-serif" }}>
      <h1>🛠 秘密の技術掲示板</h1>
      
      <div style={{ marginBottom: "40px", padding: "20px", border: "1px solid #ccc" }}>
        <h2>掲示板</h2>
        <input type="text" placeholder="名前" style={{ display: "block", marginBottom: "10px" }} />
        <textarea placeholder="ここに書き込む" style={{ display: "block", width: "100%", height: "100px", marginBottom: "10px" }}></textarea>
        <button style={{ padding: "10px 20px", cursor: "pointer" }}>投稿する</button>
      </div>

      <div style={{ background: "#f0f0f0", padding: "20px" }}>
        <h2>📜 後世に伝える技術アーカイブ</h2>
        <p>私たちが学んだ技術や知識をここに記録していきます。</p>
        {/* 自分のGitHub WikiのURLをここに貼る */}
        <a href="https://github.com/あなたのユーザー名/リポジトリ名/wiki" style={{ color: "blue", fontWeight: "bold" }}>
          技術Wiki（ナレッジベース）を開く →
        </a>
      </div>
    </div>
  );
}
