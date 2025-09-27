# 架構概覽
- Phaser Scene 模組化：Title / Shell / Map / Story / GhostComm / Mediation / Inventory / WordCards / Hints
- Router：push/pop，子模組以 Promise 回傳結果
- DataRepo：/assets/data/*.json 全資料驅動
- WorldState：位置、煞氣、陰德、旗標、已安息靈
- SaveManager：LocalStorage 快存/讀
