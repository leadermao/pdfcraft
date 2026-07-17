/**
 * Site configuration
 */
export const siteConfig = {
  name: '雨来 PDF 工具箱',
  description: '免费、私密、纯浏览器端的 PDF 工具箱。合并、拆分、压缩、转换、编辑 PDF，文件不上传服务器，全程在你的浏览器本地处理。',
  url: 'https://pdf.yusoong.com',
  ogImage: '/images/og-image.png',
  links: {
    github: 'https://github.com/leadermao/pdfcraft',
    twitter: '',
  },
  creator: '雨来',
  keywords: [
    'PDF 工具',
    'PDF 编辑器',
    '合并 PDF',
    '拆分 PDF',
    '压缩 PDF',
    '转换 PDF',
    '免费 PDF 工具',
    '在线 PDF 编辑',
    '浏览器端 PDF',
    '本地 PDF 处理',
    '雨来',
  ],
  // SEO-related settings
  seo: {
    titleTemplate: '%s | 雨来 PDF 工具箱',
    defaultTitle: '雨来 PDF 工具箱 - 专业 PDF 工具',
    twitterHandle: '',
    locale: 'zh_CN',
  },
};

/**
 * Navigation configuration
 */
export const navConfig = {
  mainNav: [
    { title: 'Home', href: '/' },
    { title: 'Tools', href: '/tools' },
    { title: 'About', href: '/about' },
    { title: 'FAQ', href: '/faq' },
  ],
  footerNav: [
    { title: 'Privacy', href: '/privacy' },
    { title: 'Contact', href: '/contact' },
  ],
};
