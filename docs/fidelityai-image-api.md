# FidelityAI 图像生成接口调用文档

> Base URL: `https://tokens.fidelityai.net`
> 接口类型: OpenAI 兼容（需 `sk-` 开头的 API Key）

---

## 调用链

```
前端 /image 页面填写 apiKey + baseUrl
        ↓
Fastify POST /image/generate
        ↓ 检测到 sk- 开头 key → OpenAI 兼容路径
POST https://tokens.fidelityai.net/v1/chat/completions
        ↓
返回 base64 图片数据
        ↓
前端渲染 <img src="data:image/png;base64,...">
```

---

## 接口

**POST** `/v1/chat/completions`

### 请求 Header

```http
Authorization: Bearer sk-xxxxxxxxxxxxxxxx
Content-Type: application/json
```

---

## 请求体

### 情况一：纯文生图（无参考图）

```json
{
  "model": "gemini-3.1-flash-image-preview",
  "messages": [
    {
      "role": "user",
      "content": "一只可爱的猫咪坐在樱花树下，水彩风格"
    }
  ]
}
```

> `content` 直接传字符串即可。

---

### 情况二：图生图（带参考图）

参考图以 base64 内联方式注入，放在最后一条 user 消息的 `content` 数组中，**图片在前，文字在后**：

```json
{
  "model": "gemini-3.1-flash-image-preview",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,/9j/4AAQSkZJRgAB..."
          }
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/png;base64,iVBORw0KGgoAAAA..."
          }
        },
        {
          "type": "text",
          "text": "保持产品外观，换成白色背景"
        }
      ]
    }
  ]
}
```

#### 参考图配额

| 类型 | 用途 | 最多张数 |
|------|------|----------|
| 对象保真参考图 | 产品、物品、场景，保持外观一致 | 10 张 |
| 角色一致性参考图 | 人物、角色，保持面貌服装风格一致 | 4 张 |

> 两类参考图拼入同一 `content` 数组，对象保真图在前，角色图在后，文字描述放最后。

---

### 情况三：多轮对话（图像编辑）

```json
{
  "model": "gemini-3.1-flash-image-preview",
  "messages": [
    {
      "role": "user",
      "content": "画一只红色的猫"
    },
    {
      "role": "assistant",
      "content": "![image](data:image/png;base64,...)"
    },
    {
      "role": "user",
      "content": "把猫的颜色改成蓝色"
    }
  ]
}
```

---

## 响应格式

图片通过以下两种方式返回，按优先级依次尝试：

### 方式一：`audio.data` 字段（主要）

```json
{
  "id": "chatcmpl-xxx",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "audio": {
          "data": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD..."
        },
        "content": null
      },
      "finish_reason": "stop"
    }
  ]
}
```

> ⚠️ 字段名为 `audio` 但实际内容是图片，值为 **base64 编码的 PNG**。

---

### 方式二：Markdown 内嵌图片（备用）

```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "![image](data:image/png;base64,/9j/4AAQSkZJRg...)"
      }
    }
  ]
}
```

---

## 响应提取逻辑

```
1. choices[0].message.audio.data        有值 → base64 PNG 图片（主要路径）
2. choices[0].message.content           匹配 ![image](data:mime;base64,xxx) → 提取 base64
3. 以上都无                              → 将 content 文本内容作为错误信息抛出
```

---

## 完整调用示例

### curl

```bash
curl https://tokens.fidelityai.net/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-xxxxxxxxxxxxxxxx" \
  -d '{
    "model": "gemini-3.1-flash-image-preview",
    "messages": [
      { "role": "user", "content": "中国水墨山水画，云雾缭绕" }
    ]
  }'
```

---

### JavaScript / TypeScript

```typescript
const API_KEY = 'sk-xxxxxxxxxxxxxxxx'
const BASE_URL = 'https://tokens.fidelityai.net'
const MODEL = 'gemini-3.1-flash-image-preview'

interface RefImage {
  mimeType: string  // e.g. "image/jpeg"
  data: string      // base64 字符串（不含 data: 前缀）
}

interface ImageResult {
  mimeType: string
  base64: string
}

async function generateImage(
  prompt: string,
  refImages: RefImage[] = []
): Promise<ImageResult> {
  // 构建 content
  const content =
    refImages.length > 0
      ? [
          ...refImages.map(img => ({
            type: 'image_url',
            image_url: { url: `data:${img.mimeType};base64,${img.data}` },
          })),
          { type: 'text', text: prompt },
        ]
      : prompt

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages: [{ role: 'user', content }] }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`API error ${res.status}: ${errText.slice(0, 200)}`)
  }

  const data = await res.json()
  const msg = data?.choices?.[0]?.message

  // 方式一：audio.data
  if (msg?.audio?.data) {
    return { mimeType: 'image/png', base64: msg.audio.data }
  }

  // 方式二：markdown 图片
  const match = msg?.content?.match(/!\[image\]\(data:([^;]+);base64,([^)]+)\)/)
  if (match) {
    return { mimeType: match[1], base64: match[2] }
  }

  // 返回错误信息
  const errMsg = (msg?.content || 'No image returned')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .trim()
  throw new Error(errMsg.slice(0, 300))
}

// 使用：纯文生图
const result = await generateImage('一只金毛犬在草地上奔跑，阳光明媚')
document.querySelector<HTMLImageElement>('#output')!.src =
  `data:${result.mimeType};base64,${result.base64}`

// 使用：图生图（需先将文件转 base64）
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const file = document.querySelector<HTMLInputElement>('#upload')!.files![0]
const refImage = { mimeType: file.type, data: await fileToBase64(file) }
const result2 = await generateImage('换成黑色背景', [refImage])
```

---

### Python

```python
import base64
import requests

API_KEY = "sk-xxxxxxxxxxxxxxxx"
BASE_URL = "https://tokens.fidelityai.net"
MODEL = "gemini-3.1-flash-image-preview"

def generate_image(prompt: str, ref_images: list[dict] = []) -> dict:
    """
    ref_images: [{"mimeType": "image/jpeg", "data": "<base64>"}]
    返回: {"mimeType": "image/png", "base64": "<base64>"}
    """
    if ref_images:
        content = [
            {"type": "image_url", "image_url": {"url": f"data:{img['mimeType']};base64,{img['data']}"}}
            for img in ref_images
        ] + [{"type": "text", "text": prompt}]
    else:
        content = prompt

    resp = requests.post(
        f"{BASE_URL}/v1/chat/completions",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {API_KEY}",
        },
        json={"model": MODEL, "messages": [{"role": "user", "content": content}]},
        timeout=120,
    )
    resp.raise_for_status()

    msg = resp.json()["choices"][0]["message"]

    # 方式一：audio.data
    if msg.get("audio", {}).get("data"):
        return {"mimeType": "image/png", "base64": msg["audio"]["data"]}

    # 方式二：markdown 图片
    import re
    match = re.search(r'!\[image\]\(data:([^;]+);base64,([^)]+)\)', msg.get("content", ""))
    if match:
        return {"mimeType": match.group(1), "base64": match.group(2)}

    raise ValueError(f"No image returned: {msg.get('content', '')[:300]}")


# 纯文生图
result = generate_image("中国水墨山水画，云雾缭绕")
with open("output.png", "wb") as f:
    f.write(base64.b64decode(result["base64"]))

# 图生图
with open("reference.jpg", "rb") as f:
    ref_b64 = base64.b64encode(f.read()).decode()

result2 = generate_image("换成白色背景", [{"mimeType": "image/jpeg", "data": ref_b64}])
with open("output2.png", "wb") as f:
    f.write(base64.b64decode(result2["base64"]))
```

---

## 注意事项

| 事项 | 说明 |
|------|------|
| API Key 格式 | 必须是 `sk-` 开头，否则会走 Google GenAI 直连路径 |
| 图片格式 | 参考图通过 `data:mimeType;base64,...` 内联传入，不支持 URL |
| 响应格式 | 图片以 base64 返回，**不是图片 URL**，需自行拼接 `data:` 前缀展示或保存 |
| 参考图顺序 | content 数组中：图片在前（对象图 → 角色图），文字描述在最后 |
| 超时设置 | 图像生成较慢，建议超时设置 ≥ 120 秒 |
| 错误处理 | 无图片返回时 content 字段即错误原因，需过滤 `<think>...</think>` 标签 |
