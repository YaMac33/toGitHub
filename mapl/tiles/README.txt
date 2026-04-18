MAPL local tiles

このフォルダには、オフライン用の地図タイルを XYZ 形式で配置します。

配置例:
tiles/
  0/
    0/
      0.png
  1/
    0/
      0.png
      1.png
    1/
      0.png
      1.png

既定設定:
- URL テンプレート: ./tiles/{z}/{x}/{y}.png
- 想定形式: PNG
- 方式: XYZ

別形式にしたい場合は data/map-config.js を編集してください。
