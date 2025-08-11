# diagram-js 利用ガイド

## 目次
1. [diagram-jsとは](#diagram-jsとは)
2. [インストールとセットアップ](#インストールとセットアップ)
3. [基本的な使い方](#基本的な使い方)
4. [コアコンセプト](#コアコンセプト)
5. [実装例](#実装例)
6. [高度な機能](#高度な機能)
7. [カスタムモジュールの作成](#カスタムモジュールの作成)
8. [ベストプラクティス](#ベストプラクティス)

## diagram-jsとは

diagram-jsは、Web上でインタラクティブな図を作成・操作するための多機能なJavaScriptライブラリです。SVGベースのレンダリング、イベント駆動アーキテクチャ、拡張可能なモジュールシステムを提供し、専門的な図エディタの基盤として機能します。

### 主な特徴

- **SVGベースのレンダリング**: 高品質でスケーラブルな図形描画
- **モジュラーアーキテクチャ**: 必要な機能だけを選択して使用可能
- **イベント駆動**: 疎結合なコンポーネント間通信
- **コマンドシステム**: Undo/Redo機能を標準搭載
- **拡張性**: カスタムモジュールやレンダラーの追加が容易

### 活用事例

diagram-jsは以下のような専門的な図エディタの基盤として使用されています：

- **bpmn-js**: BPMN 2.0プロセス図エディタ
- **cmmn-js**: CMMN 1.1ケース管理モデルエディタ
- **dmn-js**: DMN 1.3決定モデルエディタ
- **postit-js**: 付箋ボードアプリケーション

## インストールとセットアップ

### NPMでのインストール

```bash
npm install diagram-js
```

### 基本的なHTML構造

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    #diagram-container {
      width: 100%;
      height: 600px;
      border: 1px solid #ccc;
    }
  </style>
</head>
<body>
  <div id="diagram-container"></div>
  <script src="app.js"></script>
</body>
</html>
```

### 最小限のセットアップ

```javascript
import Diagram from 'diagram-js';

// ダイアグラムの作成
const diagram = new Diagram({
  canvas: {
    container: document.getElementById('diagram-container')
  }
});

// サービスの取得
const canvas = diagram.get('canvas');
const elementFactory = diagram.get('elementFactory');
```

## 基本的な使い方

### 1. 図形の追加

```javascript
// 図形の作成
const shape = elementFactory.createShape({
  id: 'shape1',
  x: 100,
  y: 100,
  width: 100,
  height: 80
});

// キャンバスに追加
canvas.addShape(shape);
```

### 2. 接続線の追加

```javascript
// 接続線の作成
const connection = elementFactory.createConnection({
  id: 'connection1',
  waypoints: [
    { x: 200, y: 140 },
    { x: 300, y: 140 }
  ],
  source: shape1,
  target: shape2
});

// キャンバスに追加
canvas.addConnection(connection);
```

### 3. イベントハンドリング

```javascript
const eventBus = diagram.get('eventBus');

// 要素クリックイベント
eventBus.on('element.click', function(event) {
  console.log('Clicked element:', event.element);
});

// 図形追加イベント
eventBus.on('shape.added', function(event) {
  console.log('Shape added:', event.element);
});
```

## コアコンセプト

### 1. 依存性注入（DI）

diagram-jsは`didi`ライブラリを使用した依存性注入システムを採用しています：

```javascript
// モジュール定義
export default {
  __init__: ['myService'],
  myService: ['type', MyService]
};

// サービスクラス
function MyService(eventBus, canvas) {
  this._eventBus = eventBus;
  this._canvas = canvas;
}

MyService.$inject = ['eventBus', 'canvas'];
```

### 2. EventBus（イベントバス）

中央集権的なイベントシステムで、コンポーネント間の通信を管理：

```javascript
// イベントの発火
eventBus.fire('custom.event', {
  element: shape,
  data: 'some data'
});

// イベントのリスニング（優先度付き）
eventBus.on('custom.event', 1000, function(event) {
  // 優先度1000で実行
});

// イベントのリスニング（通常）
eventBus.on('custom.event', function(event) {
  // デフォルト優先度で実行
});
```

### 3. CommandStack（コマンドスタック）

モデリング操作の管理とUndo/Redo機能：

```javascript
const commandStack = diagram.get('commandStack');

// コマンドの実行
commandStack.execute('shape.create', {
  shape: newShape,
  parent: rootElement
});

// Undo
commandStack.undo();

// Redo  
commandStack.redo();
```

### 4. Canvas（キャンバス）

図の表示領域とビューポート管理：

```javascript
// ズーム操作
canvas.zoom(1.5); // 150%にズーム
canvas.zoom('fit-viewport'); // 全体を表示

// スクロール
canvas.scroll({ dx: 100, dy: 50 });

// ビューボックスの取得
const viewbox = canvas.viewbox();
```

## 実装例

### 簡単なフローチャートエディタ

```javascript
import Diagram from 'diagram-js';
import ModelingModule from 'diagram-js/lib/features/modeling';
import MoveModule from 'diagram-js/lib/features/move';
import SelectionModule from 'diagram-js/lib/features/selection';

// カスタムレンダラー
function CustomRenderer(eventBus, styles) {
  BaseRenderer.call(this, eventBus, 2000);
  this._styles = styles;
}

CustomRenderer.prototype.drawShape = function(visuals, element) {
  const rect = svgCreate('rect');
  svgAttr(rect, {
    x: 0,
    y: 0,
    width: element.width,
    height: element.height,
    rx: 5,
    fill: '#fff',
    stroke: '#000'
  });
  
  svgAppend(visuals, rect);
  return rect;
};

// ダイアグラムの初期化
const diagram = new Diagram({
  canvas: {
    container: document.getElementById('container')
  },
  modules: [
    ModelingModule,
    MoveModule,
    SelectionModule,
    {
      __init__: ['customRenderer'],
      customRenderer: ['type', CustomRenderer]
    }
  ]
});

// 要素の追加
const canvas = diagram.get('canvas');
const elementFactory = diagram.get('elementFactory');
const modeling = diagram.get('modeling');

const shape1 = elementFactory.createShape({
  id: 'start',
  x: 100,
  y: 100,
  width: 100,
  height: 80,
  businessObject: { type: 'start' }
});

modeling.createShape(shape1, { x: 100, y: 100 }, canvas.getRootElement());
```

## 高度な機能

### 1. カスタムツールの作成

```javascript
function CustomTool(eventBus, canvas, dragging) {
  this._eventBus = eventBus;
  this._canvas = canvas;
  this._dragging = dragging;
  
  eventBus.on('custom-tool.init', function() {
    this.activate();
  }, this);
}

CustomTool.prototype.activate = function() {
  this._dragging.init(this._onDrag.bind(this), {
    trapClick: false,
    autoActivate: true
  });
};

CustomTool.prototype._onDrag = function(event, dx, dy) {
  // ドラッグ処理
};
```

### 2. コンテキストメニューの実装

```javascript
import ContextPadModule from 'diagram-js/lib/features/context-pad';

function CustomContextPadProvider(contextPad, modeling) {
  contextPad.registerProvider(this);
}

CustomContextPadProvider.prototype.getContextPadEntries = function(element) {
  return {
    'delete': {
      group: 'edit',
      className: 'icon-trash',
      title: 'Remove',
      action: {
        click: function(event, element) {
          modeling.removeElements([element]);
        }
      }
    }
  };
};
```

### 3. カスタムルールの定義

```javascript
function CustomRules(eventBus) {
  RuleProvider.call(this, eventBus);
}

inherits(CustomRules, RuleProvider);

CustomRules.prototype.canConnect = function(source, target) {
  // 接続可能かどうかの判定
  return source.type === 'start' && target.type === 'end';
};
```

## カスタムモジュールの作成

### モジュール構造

```javascript
// my-feature/MyService.js
export default function MyService(eventBus, canvas) {
  this._eventBus = eventBus;
  this._canvas = canvas;
  
  // 初期化処理
  eventBus.on('diagram.init', function() {
    console.log('MyService initialized');
  });
}

MyService.$inject = ['eventBus', 'canvas'];

// my-feature/index.js
import MyService from './MyService';

export default {
  __init__: ['myService'],
  myService: ['type', MyService]
};
```

### モジュールの使用

```javascript
import MyFeatureModule from './my-feature';

const diagram = new Diagram({
  modules: [
    MyFeatureModule
  ]
});
```

## ベストプラクティス

### 1. モジュール設計

- 単一責任の原則に従う
- 依存関係を明示的に宣言
- イベントベースの疎結合な設計

### 2. パフォーマンス最適化

```javascript
// バッチ更新
eventBus.fire('elements.changed', {
  elements: [shape1, shape2, shape3]
});

// ビューポート外の要素の描画スキップ
if (!canvas.viewbox().intersects(element.bounds)) {
  return;
}
```

### 3. エラーハンドリング

```javascript
eventBus.on('commandStack.execute', function(event) {
  try {
    // コマンド実行
  } catch (error) {
    eventBus.fire('error', {
      error: error,
      context: event.context
    });
  }
});
```

### 4. テスト

```javascript
import { bootstrapDiagram, inject } from 'diagram-js/test/helper';

describe('MyService', function() {
  beforeEach(bootstrapDiagram({
    modules: [MyFeatureModule]
  }));
  
  it('should do something', inject(function(myService) {
    expect(myService).to.exist;
  }));
});
```

## まとめ

diagram-jsは強力で拡張可能な図エディタフレームワークです。モジュラーアーキテクチャとイベント駆動設計により、カスタムダイアグラムエディタの構築が容易になります。本ガイドで紹介した概念と実装例を基に、独自の図エディタを構築することができます。

### 参考リソース

- [GitHub Repository](https://github.com/bpmn-io/diagram-js)
- [bpmn-js](https://github.com/bpmn-io/bpmn-js) - diagram-jsの実装例
- [Forum](https://forum.bpmn.io/) - コミュニティフォーラム