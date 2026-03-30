
export enum ProductStatus {
  ACTIVE = '上架',
  INACTIVE = '未上架',
  DRAFT = '草稿',
}

export interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
  altText: string;
  size?: number;
  mimeType?: string;
  history?: {
    altText?: string;
    updatedAt: string;
  }[];
  createdAt?: any;
}

export interface VariantOption {
  id: string;
  name: string;
  values: string[];
}

export interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  stock: number;
  image?: string;
  options: { [key: string]: string };
}

export interface Product {
  id: string;
  title: string;
  summary?: string;
  media: MediaItem[];
  description: string;
  options: VariantOption[];
  variants: ProductVariant[];
  status: ProductStatus;
  tags: string[];
  collections: string[];
  template: string;
  vendor?: string;
  category?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoUrl?: string;
  keywords?: string[];
  primaryKeyword?: string;
  jsonLd?: string;
  history?: {
    seoTitle?: string;
    seoDescription?: string;
    seoUrl?: string;
    keywords?: string[];
    jsonLd?: string;
    updatedAt: string;
  }[];
  extendedFields: { [key: string]: any };
  createdAt: string;
  updatedAt: string;
}

export interface Inquiry {
  id: string;
  customerName: string;
  email: string;
  productName: string;
  message: string;
  status: '待处理' | '已回复' | '已关闭';
  date: string;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  country: string;
  email: string;
  phones: string[];
  address: string;
  remarks: string;
  isSubscribed: boolean;
  isInquired: boolean;
  createdAt: string;
  lastActive: string;
  totalInquiries: number;
  viewCount: number;
  lastInquiryDate: string;
  tags: string[];
  emailMarketingHistory: {
    emailId: string;
    emailTitle: string;
    action: 'received' | 'opened' | 'clicked';
    timestamp: string;
  }[];
  browsingHistory: {
    path: string;
    title: string;
    timestamp: string;
  }[];
}

export interface AnalyticsData {
  date: string;
  visitors: number;
  inquiries: number;
  conversionRate: number;
}

export interface SiteConfig {
  brandName: string;
  heroTitle: string;
  heroSubtitle: string;
  primaryColor: string;
  sections: string[];
}

export interface Collection {
  id: string;
  title: string;
  description: string;
  image?: string;
  imageSize?: number;
  imageAlt?: string;
  template: string;
  productIds: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoUrl?: string;
  keywords?: string[];
  primaryKeyword?: string;
  jsonLd?: string;
  history?: {
    seoTitle?: string;
    seoDescription?: string;
    seoUrl?: string;
    keywords?: string[];
    jsonLd?: string;
    updatedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface Blog {
  id: string;
  title: string;
  content: string;
  author: string;
  tags: string[];
  image?: string;
  imageSize?: number;
  imageAlt?: string;
  status: '草稿' | '已发布';
  scheduledAt?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoUrl?: string;
  keywords?: string[];
  primaryKeyword?: string;
  jsonLd?: string;
  history?: {
    seoTitle?: string;
    seoDescription?: string;
    seoUrl?: string;
    keywords?: string[];
    jsonLd?: string;
    updatedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface BlogSet {
  id: string;
  title: string;
  description: string;
  blogIds: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoUrl?: string;
  keywords?: string[];
  jsonLd?: string;
  history?: {
    seoTitle?: string;
    seoDescription?: string;
    seoUrl?: string;
    keywords?: string[];
    jsonLd?: string;
    updatedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  title: string;
  content: string;
  template: string;
  seoTitle?: string;
  seoDescription?: string;
  seoUrl?: string;
  keywords?: string[];
  primaryKeyword?: string;
  jsonLd?: string;
  history?: {
    seoTitle?: string;
    seoDescription?: string;
    seoUrl?: string;
    keywords?: string[];
    jsonLd?: string;
    updatedAt: string;
  }[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailCampaign {
  id: string;
  title: string;
  subject: string;
  summary: string;
  sender: string;
  segmentId: string;
  status: '草稿' | '发送中' | '已发送' | '已取消';
  sentCount: number;
  openRate: number;
  clickRate: number;
  inquiryCount: number;
  unsubscribeRate: number;
  visitCount: number;
  date: string;
  content: any; // JSON structure for the editor
}

export interface EmailTemplate {
  id: string;
  name: string;
  thumbnail: string;
  content: any;
}

export interface MenuItem {
  id: string;
  label: string;
  url: string;
  type: 'link' | 'product' | 'collection' | 'blog' | 'blogSet' | 'page' | 'home' | 'search';
  referenceId?: string;
  children?: MenuItem[];
}

export interface Menu {
  id: string;
  title: string;
  handle: string;
  items: MenuItem[];
  updatedAt: string;
}

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  children?: string[];
  hasSub?: boolean;
}

export interface Section {
  id: string;
  type: string;
  name: string;
  content?: any;
}

export interface Theme {
  id: string;
  name: string;
  version: string;
  lastModified: string;
  thumbnail: string;
  hasUpdate?: boolean;
  isAI?: boolean;
  isActive?: boolean;
  sections: Section[];
  styles?: any;
  updatedAt?: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  permissions: string[]; // Array of menu labels they can access
  createdAt: string;
  updatedAt: string;
}

export interface BlogTopic {
  id: string;
  title: string;
  keywords: string[];
  type?: string;
  description?: string;
  outline?: string;
  status: '待处理' | '执行中' | '已生成' | '已忽略';
  source: 'AI' | '人工';
  targetProductIds: string[];
  targetPageIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BlogTask {
  id: string;
  topicId?: string;
  topicTitle?: string;
  targetProductIds: string[];
  status: '待执行' | '执行中' | '已完成' | '失败';
  scheduledAt: string;
  result?: {
    title: string;
    content: string;
    imageUrl: string;
    seoTitle: string;
    seoDescription: string;
    keywords: string[];
    jsonLd?: string;
    score?: number;
    scoreReason?: string;
  };
  history?: {
    title: string;
    content: string;
    imageUrl: string;
    seoTitle: string;
    seoDescription: string;
    keywords: string[];
    jsonLd?: string;
    updatedAt: string;
  }[];
  resultBlogId?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
