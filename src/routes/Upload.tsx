import { ArrowUpFromLine } from 'lucide-react';
import UploadForm from '../components/UploadForm';

export default function Upload() {
  return (
    <div>
      <h1 className="section-title">
        <ArrowUpFromLine size={22} />
        Upload a Cover
      </h1>
      <UploadForm />
    </div>
  );
}
