import UploadDownloadIcon from '../components/UploadDownloadIcon';
import UploadForm from '../components/UploadForm';

export default function Upload() {
  return (
    <div>
      <h1 className="section-title">
        <UploadDownloadIcon size={22} />
        Upload a Cover
      </h1>
      <UploadForm />
    </div>
  );
}
