/**
 * Web App Manifest Generation
 * Configures PWA settings for the application
 * 
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest
 */

import { MetadataRoute } from 'next';
import { siteConfig } from '@/config/site';

// Required for static export
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.name,
    short_name: '雨来 PDF',
    description: siteConfig.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#f4efec',
    theme_color: '#9e0101',
    orientation: 'portrait-primary',
    categories: ['productivity', 'utilities'],
    // 仅引用真实存在的图标 (上游 manifest 引用的 icon-192/512.png、screenshots/、icons/ 均不存在)
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: '合并 PDF',
        short_name: '合并',
        description: '将多个 PDF 合并成一个',
        url: '/zh/tools/merge-pdf',
      },
      {
        name: '拆分 PDF',
        short_name: '拆分',
        description: '将 PDF 拆分成多个文件',
        url: '/zh/tools/split-pdf',
      },
      {
        name: '压缩 PDF',
        short_name: '压缩',
        description: '减小 PDF 文件体积',
        url: '/zh/tools/compress-pdf',
      },
    ],
  };
}
