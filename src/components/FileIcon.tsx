import {
  File as GenericFileIcon,
  FileArchive,
  FileCode2,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
} from 'lucide-react';
import type { FileCategory } from '../types/file.ts';

interface FileIconProps {
  category: FileCategory;
  extension?: string;
  className?: string;
}

const CODE_EXTENSIONS = new Set([
  'js', 'ts', 'tsx', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h',
  'html', 'css', 'scss', 'json', 'yaml', 'yml', 'sql', 'sh', 'xml',
]);

export function FileTypeIcon({ category, extension, className = 'w-4 h-4' }: FileIconProps) {
  if (extension && CODE_EXTENSIONS.has(extension.toLowerCase())) {
    return <FileCode2 className={className} />;
  }
  switch (category) {
    case 'image':
      return <ImageIcon className={className} />;
    case 'video':
      return <Film className={className} />;
    case 'audio':
      return <Music className={className} />;
    case 'document':
      return <FileText className={className} />;
    case 'archive':
      return <FileArchive className={className} />;
    default:
      return <GenericFileIcon className={className} />;
  }
}
