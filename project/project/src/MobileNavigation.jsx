import React, { useRef } from 'react';
import { Menu, X } from 'lucide-react';

export default function MobileNavigation({ children, dark }) {
  const dialog = useRef(null);
  const previousOverflow = useRef('');
  const close = () => dialog.current?.close();
  React.useEffect(() => {
    const node = dialog.current;
    const media = window.matchMedia('(max-width: 800px)');
    const resize = () => { if (!media.matches) close(); };
    media.addEventListener('change', resize);
    return () => {
      media.removeEventListener('change', resize);
      if (node?.open) document.body.style.overflow = previousOverflow.current;
    };
  }, []);
  const open = () => {
    previousOverflow.current = document.body.style.overflow;
    dialog.current.showModal();
    document.body.style.overflow = 'hidden';
  };
  return <>
    <button type="button" className="icon-button mobile-menu-toggle" aria-label="فتح قائمة الصفحات" aria-haspopup="dialog" aria-controls="mobile-navigation" onClick={open}><Menu size={24} /></button>
    <dialog id="mobile-navigation" ref={dialog} className={`mobile-navigation ${dark ? 'dark' : ''}`} aria-label="قائمة الصفحات" onClose={() => { document.body.style.overflow = previousOverflow.current; }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <div className="sidebar mobile-sidebar" onClick={event => { if(event.target.closest('.side-nav button, .logout')) close(); }}>
        <button type="button" autoFocus className="icon-button mobile-menu-close" aria-label="إغلاق القائمة" onClick={close}><X size={23} /></button>
        {children}
      </div>
    </dialog>
  </>;
}
