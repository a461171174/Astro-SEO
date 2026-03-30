
import React from 'react';
import { Customer, Product, ProductStatus, Collection, Blog, BlogSet, Page } from './types';

export const ICONS = {
  Star: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
  ),
  Info: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="16" y2="12"/><line x1="12" x2="12.01" y1="8" y2="8"/></svg>
  ),
  Menu: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/></svg>
  ),
  Home: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
  ),
  Store: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/><path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/><path d="M12 3v6"/></svg>
  ),
  Dropshipping: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M7 10v4h3v7h4v-7h3l-5-7-5 7Z"/><path d="M12 3v4"/></svg>
  ),
  Marketing: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
  ),
  SalesChannel: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="8" cy="12" r="3"/><circle cx="16" cy="12" r="3"/><line x1="11" x2="13" y1="12" y2="12"/></svg>
  ),
  Analysis: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
  ),
  Apps: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
  ),
  Settings: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Globe: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  ),
  CheckCircle: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
  ),
  AlertTriangle: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
  ),
  XCircle: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/></svg>
  ),
  X: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
  ),
  Zap: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
  ),
  Lightbulb: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>
  ),
  RefreshCw: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
  ),
  Search: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
  ),
  Filter: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
  ),
  Columns: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/><path d="M3 12h18"/></svg>
  ),
  Sort: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="m21 8-4-4-4 4"/><path d="M17 4v16"/></svg>
  ),
  Plus: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14"/><path d="M12 5v14"/></svg>
  ),
  ChevronRight: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m9 18 6-6-6-6"/></svg>
  ),
  ChevronDown: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m6 9 6 6 6-6"/></svg>
  ),
  Edit: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
  ),
  Eye: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
  ),
  More: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
  ),
  Inquiry: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8"/><path d="M8 13h6"/></svg>
  ),
  Customer: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  ),
  Decoration: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7m0-18H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7m0-18v18"/><path d="M7 8h2"/><path d="M7 12h2"/><path d="M7 16h2"/><path d="M15 8h2"/><path d="M15 12h2"/></svg>
  ),
  Message: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
  ),
  Trash: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
  ),
  Upload: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
  ),
  Download: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
  ),
  Minimize: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M8 3v5H3"/><path d="M16 3v5h5"/><path d="M16 21v-5h5"/><path d="M8 21v-5H3"/></svg>
  ),
  Video: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
  ),
  Image: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
  ),
  Help: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
  ),
  Link: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
  ),
  ExternalLink: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/></svg>
  ),
  Tag: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l4.58-4.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>
  ),
  FileText: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
  ),
  Mail: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
  ),
  Send: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
  ),
  Type: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>
  ),
  Layout: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="9" x2="9" y1="21" y2="9"/></svg>
  ),
  Palette: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.5-.6 1.5-1.5 0-.4-.1-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.5 1.5-1.5H16c3.3 0 6-2.7 6-6 0-4.9-4.5-9-10-9Z"/></svg>
  ),
  Monitor: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>
  ),
  Smartphone: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><rect width="10" height="16" x="7" y="4" rx="2"/><path d="M12 18h.01"/></svg>
  ),
  TrendingUp: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
  ),
  TrendingDown: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>
  ),
  PieChart: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
  ),
  ArrowUpRight: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
  ),
  ArrowDownRight: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="7" y1="7" x2="17" y2="17"/><polyline points="17 7 17 17 7 17"/></svg>
  ),
  History: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
  ),
  Loader: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
  ),
  Check: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="20 6 9 17 4 12"/></svg>
  ),
  Save: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v13a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
  ),
  Bold: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
  ),
  Italic: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
  ),
  List: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
  ),
  Quote: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 2.5 1 4 3 5"/><path d="M11 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 2.5 1 4 3 5"/></svg>
  ),
  Code: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
  ),
  Heading: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M6 12h12"/><path d="M6 20V4"/><path d="M18 20V4"/></svg>
  ),
  Clock: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  ),
  Package: ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
  )
};

export const MOCK_INQUIRIES = [
  { id: '1', customerName: 'John Smith', email: 'john@example.com', productName: 'Industrial Water Pump', message: 'Interested in bulk pricing for 50 units.', status: '待处理', date: '2024-02-20' },
  { id: '2', customerName: 'Maria Garcia', email: 'maria@factory.es', productName: 'CNC Milling Machine', message: 'What is the lead time for shipping to Spain?', status: '已回复', date: '2024-02-19' },
  { id: '3', customerName: 'Chen Wei', email: 'chen@trade.cn', productName: 'Solar Panel Kit', message: 'Do you provide OEM services?', status: '待处理', date: '2024-02-18' },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { 
    id: '1', 
    name: 'John Smith', 
    company: 'Global Tech Solutions', 
    country: 'USA', 
    email: 'john@example.com', 
    phones: ['+1 234 567 890', '+1 987 654 321'],
    address: '123 Tech Lane, Silicon Valley, CA 94025',
    remarks: 'Key account, interested in industrial pumps.',
    isSubscribed: true,
    isInquired: true,
    createdAt: '2024-01-15 10:30',
    lastActive: '2024-02-20 15:45', 
    totalInquiries: 5,
    viewCount: 42,
    lastInquiryDate: '2024-02-20 15:45',
    tags: ['VIP', 'Industrial'],
    emailMarketingHistory: [
      { emailId: 'e1', emailTitle: 'Welcome to StarBoard', action: 'opened', timestamp: '2024-01-15 11:00' },
      { emailId: 'e2', emailTitle: 'New Product Launch', action: 'received', timestamp: '2024-02-01 09:00' },
    ],
    browsingHistory: [
      { path: '/', title: 'Home', timestamp: '2024-02-20 15:00' },
      { path: '/products/pump-a', title: 'Industrial Water Pump A', timestamp: '2024-02-20 15:15' },
      { path: '/contact', title: 'Contact Us', timestamp: '2024-02-20 15:45' },
    ]
  },
  { 
    id: '2', 
    name: 'Maria Garcia', 
    company: 'Iberia Manufacturing', 
    country: 'Spain', 
    email: 'maria@factory.es', 
    phones: ['+34 912 345 678'],
    address: 'Calle de la Industria 45, Madrid, 28001',
    remarks: 'Potential distributor in Europe.',
    isSubscribed: false,
    isInquired: true,
    createdAt: '2024-02-10 09:20',
    lastActive: '2024-02-19 11:30', 
    totalInquiries: 2,
    viewCount: 15,
    lastInquiryDate: '2024-02-15 14:00',
    tags: ['Distributor', 'Europe'],
    emailMarketingHistory: [
      { emailId: 'e1', emailTitle: 'Welcome to StarBoard', action: 'received', timestamp: '2024-02-10 10:00' },
    ],
    browsingHistory: [
      { path: '/products/cnc-machine', title: 'CNC Milling Machine', timestamp: '2024-02-19 11:00' },
      { path: '/about', title: 'About Us', timestamp: '2024-02-19 11:30' },
    ]
  },
  { 
    id: '3', 
    name: 'Chen Wei', 
    company: 'Oriental Trade Co.', 
    country: 'China', 
    email: 'chen@trade.cn', 
    phones: ['+86 138 0000 0000', '+86 139 1111 2222'],
    address: 'No. 888 East Nanjing Road, Shanghai, 200001',
    remarks: 'Regular buyer of solar components.',
    isSubscribed: true,
    isInquired: false,
    createdAt: '2023-12-05 14:10',
    lastActive: '2024-02-18 16:20', 
    totalInquiries: 8,
    viewCount: 120,
    lastInquiryDate: '2024-02-10 10:00',
    tags: ['Regular', 'Solar'],
    emailMarketingHistory: [
      { emailId: 'e1', emailTitle: 'Welcome to StarBoard', action: 'opened', timestamp: '2023-12-05 15:00' },
      { emailId: 'e2', emailTitle: 'New Product Launch', action: 'opened', timestamp: '2024-02-01 10:00' },
    ],
    browsingHistory: [
      { path: '/products/solar-panel', title: 'Solar Panel Kit', timestamp: '2024-02-18 16:00' },
      { path: '/cart', title: 'Shopping Cart', timestamp: '2024-02-18 16:20' },
    ]
  },
];

export const MOCK_ANALYTICS = [
  { date: '2024-01-22', visitors: 950, inquiries: 32, conversionRate: 3.37 },
  { date: '2024-01-23', visitors: 1020, inquiries: 35, conversionRate: 3.43 },
  { date: '2024-01-24', visitors: 980, inquiries: 30, conversionRate: 3.06 },
  { date: '2024-01-25', visitors: 1100, inquiries: 42, conversionRate: 3.82 },
  { date: '2024-01-26', visitors: 1150, inquiries: 40, conversionRate: 3.48 },
  { date: '2024-01-27', visitors: 1050, inquiries: 38, conversionRate: 3.62 },
  { date: '2024-01-28', visitors: 900, inquiries: 25, conversionRate: 2.78 },
  { date: '2024-01-29', visitors: 1200, inquiries: 48, conversionRate: 4.00 },
  { date: '2024-01-30', visitors: 1300, inquiries: 55, conversionRate: 4.23 },
  { date: '2024-01-31', visitors: 1250, inquiries: 50, conversionRate: 4.00 },
  { date: '2024-02-01', visitors: 1400, inquiries: 60, conversionRate: 4.29 },
  { date: '2024-02-02', visitors: 1350, inquiries: 58, conversionRate: 4.30 },
  { date: '2024-02-03', visitors: 1100, inquiries: 45, conversionRate: 4.09 },
  { date: '2024-02-04', visitors: 1000, inquiries: 35, conversionRate: 3.50 },
  { date: '2024-02-05', visitors: 1500, inquiries: 70, conversionRate: 4.67 },
  { date: '2024-02-06', visitors: 1600, inquiries: 75, conversionRate: 4.69 },
  { date: '2024-02-07', visitors: 1550, inquiries: 72, conversionRate: 4.65 },
  { date: '2024-02-08', visitors: 1450, inquiries: 65, conversionRate: 4.48 },
  { date: '2024-02-09', visitors: 1300, inquiries: 55, conversionRate: 4.23 },
  { date: '2024-02-10', visitors: 1200, inquiries: 48, conversionRate: 4.00 },
  { date: '2024-02-11', visitors: 1100, inquiries: 42, conversionRate: 3.82 },
  { date: '2024-02-12', visitors: 1250, inquiries: 50, conversionRate: 4.00 },
  { date: '2024-02-13', visitors: 1350, inquiries: 55, conversionRate: 4.07 },
  { date: '2024-02-14', visitors: 1200, inquiries: 45, conversionRate: 3.75 },
  { date: '2024-02-15', visitors: 1350, inquiries: 52, conversionRate: 3.85 },
  { date: '2024-02-16', visitors: 1100, inquiries: 38, conversionRate: 3.45 },
  { date: '2024-02-17', visitors: 1500, inquiries: 65, conversionRate: 4.33 },
  { date: '2024-02-18', visitors: 1400, inquiries: 58, conversionRate: 4.14 },
  { date: '2024-02-19', visitors: 1600, inquiries: 72, conversionRate: 4.50 },
  { date: '2024-02-20', visitors: 1750, inquiries: 85, conversionRate: 4.86 },
];

export const MOCK_PRODUCTS: Product[] = [
  { 
    id: '1', 
    title: "Women's Fashion Casual Patent Leather Sling Tight Corset Suit", 
    summary: "Elegant and sexy patent leather corset suit for modern women.",
    media: [
      { id: 'm1', type: 'image', url: 'https://picsum.photos/seed/p1/800/800', name: 'Main Image', altText: 'Corset suit front view' },
      { id: 'm2', type: 'image', url: 'https://picsum.photos/seed/p1b/800/800', name: 'Back View', altText: 'Corset suit back view' }
    ],
    description: "<p>This high-quality patent leather corset suit is designed for comfort and style. Perfect for special occasions or as a bold fashion statement.</p>",
    options: [
      { id: 'opt1', name: 'Color', values: ['Black', 'Red', 'Blue'] },
      { id: 'opt2', name: 'Size', values: ['S', 'M', 'L', 'XL'] }
    ],
    variants: [
      { id: 'v1', sku: 'CS-BLK-S', price: 49.99, stock: 100, options: { 'Color': 'Black', 'Size': 'S' } },
      { id: 'v2', sku: 'CS-RED-M', price: 54.99, stock: 50, options: { 'Color': 'Red', 'Size': 'M' } }
    ],
    status: ProductStatus.ACTIVE,
    tags: ['Fashion', 'Sexy', 'Leather'],
    collections: ['Summer Collection', 'Best Sellers'],
    template: 'Default Template',
    vendor: 'Fashion Nova',
    category: '服装',
    extendedFields: { 'Material': 'Patent Leather', 'Care': 'Hand wash only' },
    createdAt: '2024-01-20',
    updatedAt: '2024-02-24'
  },
  { 
    id: '2', 
    title: "Underwear Opening Jumpsuits Are Issued One By One", 
    summary: "Comfortable and practical jumpsuits with easy opening design.",
    media: [
      { id: 'm3', type: 'image', url: 'https://picsum.photos/seed/p2/800/800', name: 'Jumpsuit', altText: 'Jumpsuit view' }
    ],
    description: "<p>Practical design meets comfort in this unique jumpsuit. Ideal for daily wear or as a base layer.</p>",
    options: [
      { id: 'opt3', name: 'Size', values: ['One Size'] }
    ],
    variants: [
      { id: 'v3', sku: 'JS-OS', price: 29.99, stock: 200, options: { 'Size': 'One Size' } }
    ],
    status: ProductStatus.ACTIVE,
    tags: ['Underwear', 'Jumpsuit'],
    collections: ['New Arrivals'],
    template: 'Default Template',
    vendor: 'Comfort Co',
    category: '家居',
    extendedFields: {},
    createdAt: '2024-02-01',
    updatedAt: '2024-02-24'
  },
  { 
    id: '3', 
    title: "Erotic Lingerie Passion Uniform Temptation Nightdress Thong", 
    summary: "A seductive nightdress set for romantic evenings.",
    media: [
      { id: 'm4', type: 'image', url: 'https://picsum.photos/seed/p3/800/800', name: 'Nightdress', altText: 'Nightdress set' }
    ],
    description: "<p>Beautifully crafted lingerie set designed to impress.</p>",
    options: [
      { id: 'opt4', name: 'Size', values: ['S', 'M', 'L'] }
    ],
    variants: [
      { id: 'v4', sku: 'LN-S', price: 39.99, stock: 80, options: { 'Size': 'S' } }
    ],
    status: ProductStatus.ACTIVE,
    tags: ['Lingerie', 'Nightwear'],
    collections: ['Best Sellers'],
    template: 'Default Template',
    extendedFields: {},
    createdAt: '2024-02-10',
    updatedAt: '2024-02-24'
  },
  { 
    id: '4', 
    title: "Eco-Friendly Pet Bed, Sustainable Materials", 
    summary: "Soft and sustainable bed for your beloved pets.",
    media: [
      { id: 'm5', type: 'image', url: 'https://picsum.photos/seed/p10/800/800', name: 'Pet Bed', altText: 'Pet bed view' }
    ],
    description: "<p>Give your pet the comfort they deserve with our eco-friendly bed.</p>",
    options: [
      { id: 'opt5', name: 'Size', values: ['Small', 'Large'] }
    ],
    variants: [
      { id: 'v5', sku: 'PB-S', price: 59.99, stock: 30, options: { 'Size': 'Small' } }
    ],
    status: ProductStatus.INACTIVE,
    tags: ['Pet', 'Eco-friendly'],
    collections: ['New Arrivals'],
    template: 'Default Template',
    extendedFields: {},
    createdAt: '2024-02-15',
    updatedAt: '2024-02-24'
  }
];

export const MOCK_COLLECTIONS: Collection[] = [
  {
    id: 'c1',
    title: '夏季新品',
    description: '2024年夏季最热门的时尚单品。',
    image: 'https://picsum.photos/seed/summer/800/450',
    template: 'Default Template',
    productIds: ['1', '2'],
    seoTitle: '2024夏季新品系列 - Happy Paws',
    seoDescription: '探索我们最新的夏季时尚系列，包含各种透气舒适的单品。',
    seoUrl: 'summer-new-arrivals',
    createdAt: '2024-02-01',
    updatedAt: '2024-02-20'
  }
];

export const MOCK_BLOGS: Blog[] = [
  {
    id: 'b1',
    title: '如何选择适合你的时尚单品',
    content: '时尚不仅仅是跟随潮流，更是表达自我的一种方式...',
    author: 'Admin',
    tags: ['时尚', '指南'],
    image: 'https://picsum.photos/seed/blog1/800/450',
    status: '已发布',
    seoTitle: '时尚穿搭指南 - 如何选择适合你的单品',
    seoDescription: '阅读我们的专业指南，了解如何根据你的风格和体型选择最合适的时尚单品。',
    seoUrl: 'how-to-choose-fashion-items',
    createdAt: '2024-02-15',
    updatedAt: '2024-02-15'
  }
];

export const MOCK_BLOG_SETS: BlogSet[] = [
  {
    id: 'bs1',
    title: '时尚穿搭系列',
    description: '一系列关于时尚穿搭的深度文章。',
    blogIds: ['b1'],
    seoTitle: '时尚穿搭文章合集',
    seoDescription: '探索我们的时尚穿搭系列文章，获取最新的灵感。',
    seoUrl: 'fashion-guide-series',
    createdAt: '2024-02-15',
    updatedAt: '2024-02-15'
  }
];

export const MOCK_PAGES: Page[] = [
  {
    id: 'p1',
    title: '关于我们',
    content: '我们是一家致力于提供高品质时尚单品的公司...',
    template: 'Default Template',
    seoTitle: '关于我们 - Happy Paws',
    seoDescription: '了解 Happy Paws 的故事、使命和我们对品质的承诺。',
    seoUrl: 'about-us',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }
];

export const MOCK_MENUS: any[] = [
  {
    id: 'm1',
    title: '主菜单',
    handle: 'main-menu',
    items: [
      { id: 'mi1', label: '首页', url: '/', type: 'link' },
      { id: 'mi2', label: '所有商品', url: '/products', type: 'link', children: [
        { id: 'mi2-1', label: '夏季新品', url: '/collections/summer', type: 'collection' },
        { id: 'mi2-2', label: '热销爆款', url: '/collections/best-sellers', type: 'collection' }
      ]},
      { id: 'mi3', label: '关于我们', url: '/pages/about-us', type: 'page' }
    ],
    updatedAt: '2024-02-20'
  },
  {
    id: 'm2',
    title: '页脚菜单',
    handle: 'footer-menu',
    items: [
      { id: 'mi4', label: '联系我们', url: '/pages/contact', type: 'page' },
      { id: 'mi5', label: '隐私政策', url: '/pages/privacy', type: 'page' }
    ],
    updatedAt: '2024-02-20'
  }
];

export const MOCK_CAMPAIGNS: any[] = [
  {
    id: '1',
    title: '春季新品发布',
    subject: '发现我们的春季最新系列',
    summary: '限时 8 折优惠，立即查看',
    sender: 'marketing@yourstore.com',
    segmentId: 'all',
    status: '已发送',
    sentCount: 5000,
    openRate: 24.5,
    clickRate: 8.2,
    inquiryCount: 45,
    unsubscribeRate: 0.2,
    visitCount: 1200,
    date: '2026-02-20',
  },
  {
    id: '2',
    title: '复活节促销活动',
    subject: '复活节快乐！专属优惠等你来',
    summary: '全场满 $100 减 $20',
    sender: 'promo@yourstore.com',
    segmentId: 'vip',
    status: '草稿',
    sentCount: 0,
    openRate: 0,
    clickRate: 0,
    inquiryCount: 0,
    unsubscribeRate: 0,
    visitCount: 0,
    date: '2026-02-25',
  }
];
