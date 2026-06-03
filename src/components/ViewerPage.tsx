import logo from "../assets/logo.svg";
import { BundleInfo } from "../App";

interface Props {
  bundle: BundleInfo;
  onClose: () => void;
}

export default function ViewerPage({ bundle, onClose }: Props) {
  // pweb:// custom protocol — served by Rust from the extracted temp directory.
  // URL structure: pweb://<session_id>/<entry>
  const src = `pweb://${bundle.session_id}/${bundle.entry}`;

  return (
    <div className="viewer">
      <div className="viewer-toolbar">
        <button className="toolbar-back" onClick={onClose} title="Back to home">
          ←
        </button>
        <img src={logo} className="toolbar-logo" alt="" />
        <span className="toolbar-title">{bundle.title}</span>
      </div>
      <iframe
        src={src}
        className="bundle-frame"
        title={bundle.title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-pointer-lock allow-modals"
      />
    </div>
  );
}
