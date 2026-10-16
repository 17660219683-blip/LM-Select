/**
 * 厂商品牌标识。
 *
 * 三种形态，但渲染在同一个固定尺寸容器里，所以大小一致：
 *   file  —— 本地图片（public/logos/<code>.png，已统一成 128x128、白底透明、图形占 108px）
 *   icon  —— 内联 SVG 路径（24x24 viewBox，用品牌色填充）
 *   都没有 —— 品牌色首字母
 *
 * 新增厂商时照抄一条即可；想换 logo 就把 PNG 丢进 public/logos/ 再填 file 字段。
 */

const LOGO = (code) => `/logos/${code}.png`

export const VENDOR_BRAND = {
  openai: {
    label: 'OpenAI',
    initial: 'O',
    color: '#10a37f',
    file: LOGO('openai'),
  },
  anthropic: {
    label: 'Anthropic',
    initial: 'A',
    color: '#d97757',
    icon: 'M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z',
  },
  google: {
    label: 'Google',
    initial: 'G',
    color: '#4285f4',
    file: LOGO('google'),
  },
  deepseek: {
    label: 'DeepSeek',
    initial: 'D',
    color: '#4d6bfe',
    file: LOGO('deepseek'),
  },
  moonshot: {
    // 暂无 logo 文件，回退成品牌色首字母
    label: '月之暗面 Kimi',
    initial: 'K',
    color: '#1f1f1f',
  },
  bytedance: {
    label: '字节跳动 豆包',
    initial: '豆',
    color: '#325ab4',
    icon: 'M19.8772 1.4685L24 2.5326v18.9426l-4.1228 1.0563V1.4685zm-13.3481 9.428l4.115 1.0641v8.9786l-4.115 1.0642v-11.107zM0 2.572l4.115 1.0642v16.7354L0 21.428V2.572zm17.4553 5.6205v11.107l-4.1228-1.0642V9.2568l4.1228-1.0642z',
  },
  typesafeai: {
    label: 'TypeSafe AI',
    initial: 'T',
    color: '#3fbdbd',
    file: LOGO('typesafeai'),
  },
}

/** 取不到配置时用中性灰兜底，不要因为后端多一个厂商就渲染崩掉 */
export function vendorBrand(code) {
  if (VENDOR_BRAND[code]) return VENDOR_BRAND[code]

  return {
    label: code ?? '未知厂商',
    initial: String(code ?? '?').charAt(0).toUpperCase(),
    color: '#6d6580',
  }
}
