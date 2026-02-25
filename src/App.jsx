import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
// PERBAIKAN: Menggunakan HashRouter untuk kompatibilitas Cloudflare Pages
import { HashRouter as Router, Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  collection, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  serverTimestamp, 
  query, 
  orderBy,
  deleteDoc
} from 'firebase/firestore';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  CheckCircle, 
  LogOut, 
  Edit3, 
  List, 
  Mail,
  UserPlus,
  ArrowRight,
  Image as ImageIcon,
  AlertTriangle,
  Map as MapIcon,
  Bell,
  X,
  Share2,
  History,
  PlusCircle,
  CheckCircle2
} from 'lucide-react';

/**
 * ------------------------------------------------------------------
 * 1. KONFIGURASI FIREBASE & DETEKSI MODE DEMO
 * ------------------------------------------------------------------
 */
const firebaseConfig = {
  apiKey: "AIzaSyAFOJfMCSqBdcrS3hktgMGPnnjmgritQTI",
  authDomain: "undangan-pmrsmanel.firebaseapp.com",
  projectId: "undangan-pmrsmanel",
  storageBucket: "undangan-pmrsmanel.firebasestorage.app",
  messagingSenderId: "977207697113",
  appId: "1:977207697113:web:af5d265d8893885eec28c8"
};

// URL Google Apps Script (Opsional untuk rekap gsheets)
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyvdWX093tHi_e4o7UQ5tR_Myvy80u28sU3TO5CNG_JpgKz90PSeok0mt5gfnE9yCve/exec"; 

// PERBAIKAN: Matikan paksa Mode Demo karena kita sudah siap Live!
const isDemoMode = false;

let app, auth, db;

if (!isDemoMode) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error("Firebase init error:", error);
  }
}

/**
 * ------------------------------------------------------------------
 * 2. AUTH CONTEXT (Support Demo & Live)
 * ------------------------------------------------------------------
 */
const AuthContext = createContext();

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      const storedUser = localStorage.getItem('demo_user');
      if (storedUser) setUser(JSON.parse(storedUser));
      setLoading(false);
    } else if (auth) {
      try {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        }, (error) => {
          console.error("Auth state error:", error);
          setLoading(false);
        });
        return () => unsubscribe();
      } catch (err) {
        console.error("Error setting up auth listener:", err);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    if (isDemoMode) {
      if (password === 'admin' || password === 'admin123') {
        const fakeUser = { email, uid: 'demo-admin-123' };
        setUser(fakeUser);
        localStorage.setItem('demo_user', JSON.stringify(fakeUser));
        return;
      }
      throw new Error("Password salah (Hint: gunakan 'admin')");
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  };

  const logout = async () => {
    if (isDemoMode) {
      setUser(null);
      localStorage.removeItem('demo_user');
    } else {
      await signOut(auth);
    }
  };

  const register = async (email, password) => {
      if (isDemoMode) {
        const fakeUser = { email, uid: 'demo-new-user-' + Date.now() };
        setUser(fakeUser);
        localStorage.setItem('demo_user', JSON.stringify(fakeUser));
        return;
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};

const useAuth = () => useContext(AuthContext);

/**
 * ------------------------------------------------------------------
 * KOMPONEN UTILITIES PETA (Iframe Picker Bebas Dependency)
 * ------------------------------------------------------------------
 */
const LocationPickerIframe = ({ position, setPosition }) => {
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.type === 'MAP_CLICK') {
        setPosition({ 
          latitude: event.data.lat.toFixed(6), 
          longitude: event.data.lng.toFixed(6) 
        });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setPosition]);

  const mapHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; cursor: crosshair; }</style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var lat = ${position.latitude && !isNaN(parseFloat(position.latitude)) ? parseFloat(position.latitude) : -6.200000};
        var lng = ${position.longitude && !isNaN(parseFloat(position.longitude)) ? parseFloat(position.longitude) : 106.816666};
        var map = L.map('map').setView([lat, lng], ${position.latitude ? 15 : 10});
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        var marker = L.marker([lat, lng]).addTo(map);
        map.on('click', function(e) {
          marker.setLatLng(e.latlng);
          window.parent.postMessage({ type: 'MAP_CLICK', lat: e.latlng.lat, lng: e.latlng.lng }, '*');
        });
      </script>
    </body>
    </html>
  `;

  return (
    <iframe 
      title="Map Picker"
      srcDoc={mapHtml}
      style={{ width: '100%', height: '100%', border: 'none', borderRadius: '0.75rem' }}
    />
  );
};

/**
 * ------------------------------------------------------------------
 * 3. KOMPONEN UI & UTILITIES UMUM
 * ------------------------------------------------------------------
 */
const Notification = ({ message, type }) => {
  if (!message) return null;
  const bgColor = type === 'success' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200';
  return (
    <div className={`p-4 mb-4 rounded-lg border ${bgColor} text-center animate-pulse`}>
      {message}
    </div>
  );
};

const ToastContainer = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div 
          key={toast.id} 
          className="bg-white border-l-4 border-red-600 shadow-xl rounded-md p-4 w-full sm:w-72 transform transition-all duration-300 hover:scale-105 flex items-start justify-between animate-in slide-in-from-right pointer-events-auto mx-auto sm:mx-0"
        >
          <div className="flex items-start gap-3">
            <div className="bg-red-100 p-1.5 rounded-full mt-0.5">
              <Bell className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-800">Notifikasi</h4>
              <p className="text-xs text-gray-600 mt-1">{toast.message}</p>
              <p className="text-[10px] text-gray-400 mt-1">{new Date().toLocaleTimeString()}</p>
            </div>
          </div>
          <button onClick={() => removeToast(toast.id)} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

const DemoBanner = () => {
  if (!isDemoMode) return null;
  return (
    <div className="bg-yellow-500 text-white text-xs py-1 px-4 text-center font-medium flex items-center justify-center gap-2 z-50 relative">
      <AlertTriangle className="w-3 h-3" />
      Mode Demo: Database menggunakan penyimpanan lokal. Masukkan API Key Firebase untuk mode live.
    </div>
  );
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <>
      <DemoBanner />
      <nav className="bg-white shadow-md sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/" className="text-xl font-bold text-red-600 flex items-center gap-2">
            <Mail className="w-6 h-6 text-red-600" />
            PMR SMANEL
          </Link>
          <div className="flex items-center gap-4">
            {!user && (
              <Link to="/rsvp" className="text-sm font-medium text-gray-600 hover:text-red-600 hidden md:block">
                Konfirmasi Kehadiran
              </Link>
            )}
            
            {user ? (
              <div className="flex items-center gap-4 border-l pl-4 ml-2 border-gray-200">
                <Link to="/admin" className="text-gray-600 hover:text-red-600 font-medium text-sm">Dashboard</Link>
                <button onClick={handleLogout} className="text-red-600 hover:text-red-800" title="Logout">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <Link to="/login" className="text-sm font-medium text-gray-400 hover:text-gray-600 ml-2">Login</Link>
            )}
          </div>
        </div>
      </nav>
    </>
  );
};

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

// UTILITY UNTUK FORMAT TANGGAL DAN WAKTU
const formatDateUI = (dateStr) => {
  if (!dateStr) return "-";
  // Cek apakah format dari date picker (YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const dateObj = new Date(dateStr);
    return dateObj.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
  return dateStr; // fallback jika data lama
};

const formatTimeUI = (timeStr) => {
  if (!timeStr) return "-";
  // Cek apakah format dari time picker (HH:MM)
  if (/^\d{2}:\d{2}$/.test(timeStr)) {
    return `${timeStr} WIB`;
  }
  return timeStr;
};

/**
 * ------------------------------------------------------------------
 * 4. HALAMAN UTAMA (INFO KEGIATAN & SHARE)
 * ------------------------------------------------------------------
 */
const Home = () => {
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const defaultEvent = {
    title: "Belum Ada Informasi Kegiatan",
    date: "-",
    time: "-",
    location: "-",
    description: "Admin belum memasukkan data kegiatan terbaru.",
    backgroundImage: "",
    latitude: "",
    longitude: ""
  };

  useEffect(() => {
    if (isDemoMode) {
      const saved = localStorage.getItem('demo_event_data');
      setEventData(saved ? JSON.parse(saved) : defaultEvent);
      setLoading(false);
    } else {
      try {
        const unsub = onSnapshot(doc(db, "event_details", "main_event"), (doc) => {
          if (doc.exists()) {
            setEventData(doc.data());
          } else {
            setEventData(defaultEvent);
          }
          setLoading(false);
        }, (error) => {
          console.log("Firestore unavailable, falling back to default");
          setEventData(defaultEvent);
          setLoading(false);
        });
        return () => unsub();
      } catch (e) {
        setEventData(defaultEvent);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (eventData) {
      document.title = `${eventData.title} - Undangan PMR`;
      const updateMeta = (attributeType, attributeName, content) => {
        let element = document.querySelector(`meta[${attributeType}='${attributeName}']`);
        if (!element) {
          element = document.createElement('meta');
          element.setAttribute(attributeType, attributeName);
          document.head.appendChild(element);
        }
        element.setAttribute('content', content);
      };
      const shortDesc = `Ikuti kegiatan kami pada ${formatDateUI(eventData.date)} di ${eventData.location}. ${eventData.description.substring(0, 100)}...`;
      
      updateMeta('property', 'og:title', eventData.title);
      updateMeta('property', 'og:description', shortDesc);
      updateMeta('property', 'og:image', eventData.backgroundImage);
      updateMeta('property', 'og:url', window.location.href);
      updateMeta('property', 'og:type', 'website');
      updateMeta('name', 'twitter:card', 'summary_large_image');
      updateMeta('name', 'twitter:title', eventData.title);
      updateMeta('name', 'twitter:description', shortDesc);
      updateMeta('name', 'twitter:image', eventData.backgroundImage);
    }
  }, [eventData]);

  const handleShare = async () => {
    if (!eventData) return;
    const shareData = {
      title: eventData.title,
      text: `Undangan Resmi: ${eventData.title}\n📅 ${formatDateUI(eventData.date)}\n📍 ${eventData.location}\n\n${eventData.description}`,
      url: window.location.href
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) { console.log('User cancelled share'); }
    } else {
      navigator.clipboard.writeText(`${shareData.text}\nLink: ${shareData.url}`);
      alert('Link dan detail acara telah disalin ke clipboard! Siap ditempel di WhatsApp.');
    }
  };

  if (loading) return <div className="text-center p-10">Memuat Undangan...</div>;

  const backgroundStyle = eventData?.backgroundImage 
    ? { backgroundImage: `url('${eventData.backgroundImage}')`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  const hasCoordinates = eventData?.latitude && eventData?.longitude;
  const mapUrl = hasCoordinates 
    ? `https://maps.google.com/maps?q=${eventData.latitude},${eventData.longitude}&t=&z=15&ie=UTF8&iwloc=&output=embed` 
    : "";

  return (
    <div className="bg-gray-50 min-h-screen pb-10">
      <div 
        className="relative w-full min-h-[500px] md:h-[550px] bg-gray-800 text-white rounded-b-[2rem] md:rounded-b-[3rem] shadow-xl overflow-hidden flex flex-col" 
        style={backgroundStyle}
      >
        <div className="absolute inset-0 bg-black/60 bg-gradient-to-t from-black/90 to-transparent"></div>
        
        <div className="relative z-10 flex-grow flex flex-col justify-center items-center text-center px-4 sm:px-6 max-w-4xl mx-auto py-10 md:py-12">
          <p className="uppercase tracking-[0.3em] text-[10px] sm:text-xs md:text-sm font-semibold mb-3 sm:mb-4 text-red-400 border border-red-500/50 px-4 py-1 rounded-full bg-black/30 backdrop-blur-sm">
            Undangan Resmi
          </p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 leading-tight drop-shadow-lg break-words w-full px-2 sm:px-0">
            {eventData?.title}
          </h1>
          
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-6 mt-2 text-gray-200 text-sm sm:text-base md:text-lg font-medium w-full sm:w-auto items-center justify-center">
             <div className="flex items-center gap-2 bg-white/10 px-5 py-2.5 sm:py-2 rounded-full backdrop-blur-md w-full sm:w-auto justify-center">
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                {formatDateUI(eventData?.date)}
             </div>
             <div className="flex items-center gap-2 bg-white/10 px-5 py-2.5 sm:py-2 rounded-full backdrop-blur-md w-full sm:w-auto justify-center">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                {formatTimeUI(eventData?.time)}
             </div>
          </div>
          
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full justify-center">
            <Link to="/rsvp" className="w-full sm:w-auto group bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 sm:py-3 px-8 rounded-full transition-all shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 text-sm sm:text-base">
              Konfirmasi Kehadiran
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <button 
              onClick={handleShare}
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white border border-white/30 font-semibold py-3.5 sm:py-3 px-6 rounded-full transition-all flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Share2 className="w-4 h-4 sm:w-5 sm:h-5" />
              Bagikan Undangan
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-10 md:-mt-16 relative z-20 pb-8">
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-5 sm:p-6 md:p-8 mb-8">
           <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
              <div className="flex-1 space-y-5 sm:space-y-6 w-full">
                <div>
                  <h3 className="text-gray-500 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2">Lokasi Kegiatan</h3>
                  <div className="flex items-start gap-2 sm:gap-3">
                    <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 mt-0.5 sm:mt-1 flex-shrink-0" />
                    <p className="text-lg sm:text-xl font-bold text-gray-800 break-words">{eventData?.location}</p>
                  </div>
                </div>
                <div className="border-t pt-5 sm:pt-6">
                  <h3 className="text-gray-500 text-xs sm:text-sm font-semibold uppercase tracking-wider mb-2">Tentang Acara</h3>
                  <p className="text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-3 text-sm sm:text-base">{eventData?.description}</p>
                  
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="mt-3 text-red-600 hover:text-red-700 font-medium text-sm flex items-center gap-1 transition-colors group"
                  >
                    Lihat Detail Selengkapnya <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
              
              <div className="w-full md:w-1/3 h-64 bg-gray-100 rounded-xl overflow-hidden shadow-inner border border-gray-200">
                 {hasCoordinates ? (
                   <iframe 
                     title="Peta Lokasi"
                     width="100%" 
                     height="100%" 
                     src={mapUrl}
                     frameBorder="0" 
                     scrolling="no" 
                     marginHeight="0" 
                     marginWidth="0"
                     className="w-full h-full"
                   ></iframe>
                 ) : (
                   <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                     <MapPin className="w-8 h-8 mb-2 opacity-50" />
                     <span className="text-sm">Peta tidak tersedia.<br/>Hubungi Admin untuk set koordinat.</span>
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>

      {/* POPUP / MODAL DETAIL ACARA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header Pop-up */}
            <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <h3 className="text-base sm:text-lg font-bold text-gray-800 flex items-center gap-2">
                <List className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                Rangkuman Kegiatan
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-gray-800 bg-white hover:bg-gray-200 p-1.5 sm:p-2 rounded-full transition-colors shadow-sm border border-gray-200"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
            
            {/* Isi Pop-up */}
            <div className="p-5 sm:p-6 md:p-8 overflow-y-auto flex-grow custom-scrollbar">
              {eventData?.backgroundImage && (
                <div className="w-full h-40 sm:h-48 md:h-64 rounded-xl sm:rounded-2xl overflow-hidden mb-5 sm:mb-6 shadow-sm border border-gray-100 relative group">
                  <img 
                    src={eventData.backgroundImage} 
                    alt={eventData.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                </div>
              )}

              <h4 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 leading-tight">{eventData?.title}</h4>
              
              <div className="flex flex-col gap-3 sm:gap-4 mb-6 sm:mb-8 p-4 sm:p-5 bg-red-50/50 rounded-xl sm:rounded-2xl border border-red-100 text-sm md:text-base text-gray-700">
                 <div className="flex items-center gap-3">
                   <div className="bg-white p-2 rounded-full shadow-sm flex-shrink-0"><Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-red-500"/></div>
                   <span className="font-medium break-words">{formatDateUI(eventData?.date)}</span>
                 </div>
                 <div className="flex items-center gap-3">
                   <div className="bg-white p-2 rounded-full shadow-sm flex-shrink-0"><Clock className="w-4 h-4 sm:w-5 sm:h-5 text-red-500"/></div>
                   <span className="font-medium break-words">{formatTimeUI(eventData?.time)}</span>
                 </div>
                 <div className="flex items-start gap-3">
                   <div className="bg-white p-2 rounded-full shadow-sm flex-shrink-0"><MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-red-500"/></div>
                   <span className="font-medium mt-0.5 sm:mt-1 leading-snug break-words">{eventData?.location}</span>
                 </div>
              </div>
              
              <div className="prose max-w-none">
                <h5 className="text-xs sm:text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 sm:mb-3">Deskripsi Lengkap</h5>
                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed text-sm sm:text-base">
                  {eventData?.description}
                </p>
              </div>
            </div>
            
            {/* Footer Pop-up */}
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/80 flex justify-end gap-3 sm:flex-row flex-col">
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 px-6 py-2.5 sm:py-3 rounded-xl font-bold transition-colors w-full sm:w-auto text-sm sm:text-base"
              >
                Tutup
              </button>
              <Link 
                to="/rsvp"
                onClick={() => setIsModalOpen(false)} 
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 sm:py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-200 text-center flex items-center justify-center gap-2 w-full sm:w-auto text-sm sm:text-base"
              >
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> RSVP Sekarang
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

/**
 * ------------------------------------------------------------------
 * 5. HALAMAN RSVP
 * ------------------------------------------------------------------
 */
const RsvpPage = () => {
  const [rsvpStatus, setRsvpStatus] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    institution: '',
    status: 'Hadir',
    message: ''
  });

  const handleSubmitRSVP = async (e) => {
    e.preventDefault();
    if(!formData.name || !formData.institution) return;

    if (isDemoMode) {
      const existing = JSON.parse(localStorage.getItem('demo_rsvps') || '[]');
      const newRsvp = { ...formData, id: Date.now(), timestamp: new Date().toISOString() };
      localStorage.setItem('demo_rsvps', JSON.stringify([newRsvp, ...existing]));
      
      setRsvpStatus('success');
      setFormData({ name: '', institution: '', status: 'Hadir', message: '' });
      setTimeout(() => setRsvpStatus(''), 5000);
      return;
    }

    try {
      await addDoc(collection(db, "rsvps"), {
        ...formData,
        timestamp: serverTimestamp()
      });

      if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== "URL_GOOGLE_SCRIPT_ANDA_DISINI") {
        const formToSubmit = new FormData();
        formToSubmit.append('Timestamp', new Date().toLocaleString('id-ID'));
        formToSubmit.append('Nama', formData.name);
        formToSubmit.append('Instansi', formData.institution);
        formToSubmit.append('Status', formData.status);
        formToSubmit.append('Pesan', formData.message);

        fetch(GOOGLE_SCRIPT_URL, { 
          method: 'POST', 
          body: formToSubmit,
          mode: 'no-cors' 
        }).catch(err => console.error("Google Sheets Error:", err));
      }

      setRsvpStatus('success');
      setFormData({ name: '', institution: '', status: 'Hadir', message: '' });
      setTimeout(() => setRsvpStatus(''), 5000);
    } catch (error) {
      console.error("Error adding RSVP: ", error);
      alert("Gagal menyimpan RSVP. Cek konfigurasi Anda.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-red-600 p-6 text-white text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-2 text-white/90" />
          <h2 className="text-2xl font-bold">Konfirmasi Kehadiran</h2>
          <p className="text-red-100 text-sm mt-1">Isi formulir untuk pendataan panitia</p>
        </div>

        <div className="p-8">
          {rsvpStatus === 'success' ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Terima Kasih!</h3>
              <p className="text-gray-600 mb-6">Konfirmasi kehadiran Anda telah kami terima.</p>
              <Link to="/" className="text-red-600 font-medium hover:underline">Kembali ke Beranda</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmitRSVP} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none transition-all"
                  placeholder="Nama Anda"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Asal Sekolah / Instansi</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none transition-all"
                  placeholder="Contoh: SMANEL"
                  value={formData.institution}
                  onChange={(e) => setFormData({...formData, institution: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status Kehadiran</label>
                <select 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none transition-all bg-white"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                >
                  <option value="Hadir">Saya akan Hadir</option>
                  <option value="Berhalangan">Mohon Maaf, Berhalangan</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pesan (Opsional)</label>
                <textarea 
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none transition-all"
                  rows="3"
                  placeholder="Pesan untuk panitia..."
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                ></textarea>
              </div>
              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-200 mt-2">
                Kirim Data
              </button>
              <div className="text-center mt-4">
                 <Link to="/" className="text-sm text-gray-500 hover:text-gray-800">Batal, kembali ke info</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * ------------------------------------------------------------------
 * 6. HALAMAN LOGIN & DAFTAR AKUN
 * ------------------------------------------------------------------
 */
const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, login } = useAuth(); 

  useEffect(() => {
    if (user) navigate('/admin');
  }, [user, navigate]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    
    let emailToUse = username;
    // Otomatis ubah "admin" menjadi email agar mudah diingat
    if (username.toLowerCase() === 'admin') {
      emailToUse = 'admin@smanel.com';
    }

    try {
      // PROSES LOGIN BIASA (Tanpa fitur daftar publik)
      await login(emailToUse, password);
      navigate('/admin');
    } catch (err) {
      // Menyembunyikan log error merah di console apabila disebabkan oleh kesalahan kredensial wajar
      if (err.code !== 'auth/invalid-credential' && err.code !== 'auth/wrong-password' && err.code !== 'auth/user-not-found') {
         console.error("Login Error:", err);
      }
      
      // Penanganan spesifik untuk error login ke tampilan pengguna
      if (err.code === 'auth/configuration-not-found') {
        setError("Error: Fitur Login belum diaktifkan. Buka Firebase Console > Build > Authentication > Get Started > Aktifkan penyedia Email/Password.");
      } else if (err.code === 'auth/invalid-api-key') {
        setError("API Key tidak valid. Silakan periksa kembali firebaseConfig Anda.");
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError("Gagal: Username atau Password salah. (Pastikan akun admin@smanel.com sudah dibuat di Firebase Console).");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Terlalu banyak percobaan gagal. Silakan coba lagi nanti.");
      } else if (isDemoMode) {
        setError(err.message);
      } else {
         if(err.code === 'auth/invalid-email') {
            setError("Format email salah. Jika pakai username, gunakan 'admin'.");
         } else {
            setError("Login gagal. Detail: " + err.message);
         }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full">
        <div className="text-center mb-6">
          <Mail className="w-12 h-12 text-red-600 mx-auto mb-2" />
          <h2 className="text-2xl font-bold text-gray-800">Login Panitia</h2>
        </div>
        
        {error && <Notification message={error} type="error" />}
        
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Username / Email</label>
            <input 
              type="text" 
              placeholder="admin" 
              required
              className="w-full px-4 py-2 border rounded-lg focus:border-red-500 focus:outline-none"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Password</label>
            <input 
              type="password" 
              placeholder="••••••" 
              required
              className="w-full px-4 py-2 border rounded-lg focus:border-red-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          
          <div className="bg-blue-50 p-3 rounded text-xs text-blue-800 mb-2">
            <p><strong>Info:</strong> Masukkan akun yang telah didaftarkan oleh Administrator.</p>
          </div>

          <button type="submit" className="w-full bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors">
            Masuk Dashboard
          </button>
        </form>

        <div className="mt-6 text-center border-t pt-4">
          <Link to="/" className="text-sm text-gray-500 hover:text-red-600">← Kembali ke Undangan</Link>
        </div>
      </div>
    </div>
  );
};

/**
 * ------------------------------------------------------------------
 * 7. DASHBOARD ADMIN
 * ------------------------------------------------------------------
 */
const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('event');
  const [eventForm, setEventForm] = useState({
    id: '', title: '', date: '', time: '', location: '', description: '', backgroundImage: '',
    latitude: '', longitude: ''
  });
  const [rsvpList, setRsvpList] = useState([]);
  const [eventsHistory, setEventsHistory] = useState([]); 
  const [msg, setMsg] = useState('');
  const [isUploading, setIsUploading] = useState(false); // State loading untuk upload gambar
  const { register } = useAuth(); 

  const [toasts, setToasts] = useState([]);
  const addToast = (message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => removeToast(id), 5000); 
  };
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const isFirstLoad = useRef(true);
  const prevRsvpCount = useRef(0);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPass, setNewUserPass] = useState('');

  // Fetch Event Data Utama
  useEffect(() => {
    if (isDemoMode) {
      const saved = localStorage.getItem('demo_event_data');
      if (saved) setEventForm(JSON.parse(saved));
      else {
          setEventForm({
            id: 'main-event-id',
            title: "",
            date: "",
            time: "",
            location: "",
            description: "",
            backgroundImage: "",
            latitude: "",
            longitude: ""
          });
      }
    } else {
      try {
        const unsub = onSnapshot(doc(db, "event_details", "main_event"), (doc) => {
          if (doc.exists()) {
             const data = doc.data();
             setEventForm({
               ...data,
               id: data.id || 'main-event-id',
               latitude: data.latitude || '',
               longitude: data.longitude || ''
             });
          }
        });
        return () => unsub();
      } catch(e) {}
    }
  }, []);

  // Fetch History Rekap
  useEffect(() => {
    if (isDemoMode) {
        const savedHistory = JSON.parse(localStorage.getItem('demo_events_history') || '[]');
        setEventsHistory(savedHistory);
    } else {
      try {
        const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
        const unsub = onSnapshot(q, (snapshot) => {
          const list = snapshot.docs.map(doc => ({ ...doc.data(), docId: doc.id }));
          setEventsHistory(list);
        });
        return () => unsub();
      } catch(e) {}
    }
  }, []);

  // Fetch RSVP
  useEffect(() => {
    if (isDemoMode) {
        const interval = setInterval(() => {
            const saved = JSON.parse(localStorage.getItem('demo_rsvps') || '[]');
            if (saved.length > prevRsvpCount.current && prevRsvpCount.current !== 0) {
              const latest = saved[0]; 
              addToast(`${latest.name} (${latest.institution}) baru saja mendaftar!`);
            }
            if (saved.length !== prevRsvpCount.current) {
               prevRsvpCount.current = saved.length;
               setRsvpList(saved);
            }
            if (prevRsvpCount.current === 0 && saved.length > 0) {
               prevRsvpCount.current = saved.length;
            }
        }, 1000);
        return () => clearInterval(interval);
    } else {
      try {
        const q = query(collection(db, "rsvps"), orderBy("timestamp", "desc"));
        const unsub = onSnapshot(q, (snapshot) => {
          const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setRsvpList(list);

          snapshot.docChanges().forEach((change) => {
            if (change.type === "added" && !isFirstLoad.current) {
               const data = change.doc.data();
               addToast(`${data.name} (${data.institution}) baru saja mendaftar!`);
            }
          });
          
          isFirstLoad.current = false; 
        });
        return () => unsub();
      } catch(e) {}
    }
  }, []);

  const handleUpdateEvent = async (e) => {
    e.preventDefault();
    const eventId = eventForm.id || Date.now().toString();
    const eventToSave = { ...eventForm, id: eventId, createdAt: eventForm.createdAt || new Date().toISOString() };

    if (isDemoMode) {
      localStorage.setItem('demo_event_data', JSON.stringify(eventToSave));
      const history = JSON.parse(localStorage.getItem('demo_events_history') || '[]');
      const existingIdx = history.findIndex(x => x.id === eventId);
      if (existingIdx > -1) history[existingIdx] = eventToSave;
      else history.unshift(eventToSave);
      localStorage.setItem('demo_events_history', JSON.stringify(history));
      setEventsHistory(history);

      setMsg("Data kegiatan diperbarui & disimpan ke rekap (Demo)!");
      setTimeout(() => setMsg(''), 3000);
      return;
    }

    try {
      await setDoc(doc(db, "event_details", "main_event"), eventToSave);
      await setDoc(doc(db, "events", eventId), eventToSave);
      setMsg("Data kegiatan diperbarui & disimpan ke rekap!");
      setTimeout(() => setMsg(''), 3000);
    } catch (error) {
      console.error("Error updating event:", error);
      setMsg("Gagal update data.");
    }
  };

  const handleSetMainEvent = async (eventData) => {
    if (isDemoMode) {
      localStorage.setItem('demo_event_data', JSON.stringify(eventData));
      setEventForm(eventData);
      setMsg("Kegiatan berhasil diaktifkan!");
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    try {
      await setDoc(doc(db, "event_details", "main_event"), eventData);
      setEventForm(eventData);
      setMsg("Kegiatan berhasil diaktifkan!");
      setTimeout(() => setMsg(''), 3000);
    } catch(e) {
      alert("Gagal mengaktifkan kegiatan.");
    }
  };

  const handleDeleteEvent = async (eventId, isActive) => {
    if (isActive) {
      alert("Tidak dapat menghapus kegiatan yang sedang aktif!");
      return;
    }
    if (!window.confirm("Apakah Anda yakin ingin menghapus riwayat kegiatan ini? Data tidak dapat dikembalikan.")) return;

    if (isDemoMode) {
      const history = JSON.parse(localStorage.getItem('demo_events_history') || '[]');
      const updatedHistory = history.filter(evt => evt.id !== eventId);
      localStorage.setItem('demo_events_history', JSON.stringify(updatedHistory));
      setEventsHistory(updatedHistory);
      setMsg("Kegiatan berhasil dihapus (Mode Demo).");
      setTimeout(() => setMsg(''), 3000);
      return;
    }

    try {
      await deleteDoc(doc(db, "events", eventId));
      setMsg("Kegiatan berhasil dihapus!");
      setTimeout(() => setMsg(''), 3000);
    } catch (error) {
      console.error("Error deleting event:", error);
      alert("Gagal menghapus kegiatan. Pastikan koneksi internet stabil.");
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await register(newUserEmail, newUserPass);
      alert(isDemoMode ? "User simulasi berhasil dibuat!" : "User baru berhasil dibuat! Anda login sebagai user baru.");
      setNewUserEmail('');
      setNewUserPass('');
    } catch (error) {
      alert("Gagal membuat user: " + error.message);
    }
  };

  // Fungsi Upload Gambar Menggunakan Layanan Gratis ImgBB
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Batasi ukuran gambar maksimal 2MB agar loading web tetap cepat
    if (file.size > 2 * 1024 * 1024) {
      alert('Ukuran gambar terlalu besar. Maksimal 2MB.');
      return;
    }

    setIsUploading(true);

    if (isDemoMode) {
       const reader = new FileReader();
       reader.onloadend = () => {
          setEventForm({ ...eventForm, backgroundImage: reader.result });
          setIsUploading(false);
          addToast("Gambar berhasil dimuat (Mode Demo)!");
       };
       reader.readAsDataURL(file);
       return;
    }

    try {
      // API KEY IMGBB ANDA SUDAH TERPASANG
      const IMGBB_API_KEY = "e428d28e8f123d7c9ddda1900c361513"; 

      const formData = new FormData();
      formData.append('image', file);

      // Mengirim gambar langsung ke server ImgBB
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
         // Mengambil URL Direct gambar yang sudah terupload dan menyimpannya di form
         setEventForm({ ...eventForm, backgroundImage: data.data.url });
         addToast("Gambar berhasil diunggah ke ImgBB!");
      } else {
         throw new Error(data.error?.message || "Gagal mengunggah ke server gambar.");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      alert(`Gagal mengunggah gambar: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Fungsi Dapatkan Lokasi Saat Ini
  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      addToast("Mencari lokasi Anda...");
      navigator.geolocation.getCurrentPosition((position) => {
        setEventForm({
          ...eventForm,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        });
        addToast("Lokasi berhasil didapatkan!");
      }, (error) => {
        alert("Gagal mendapatkan lokasi. Pastikan izin lokasi diaktifkan pada browser Anda.");
      });
    } else {
      alert("Browser Anda tidak mendukung fitur lokasi.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8">
           <h1 className="text-3xl font-bold text-gray-800">Dashboard Admin</h1>
           <span className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded-full">
             {isDemoMode ? 'Mode Demo' : 'Mode Live'}
           </span>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('event')}
            className={`pb-3 px-4 font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === 'event' ? 'text-red-600 border-red-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
          >
            <div className="flex items-center gap-2"><Edit3 className="w-4 h-4"/> Edit Kegiatan</div>
          </button>
          <button 
            onClick={() => setActiveTab('rsvp')}
            className={`pb-3 px-4 font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === 'rsvp' ? 'text-red-600 border-red-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
          >
            <div className="flex items-center gap-2"><List className="w-4 h-4"/> Data Tamu ({rsvpList.length})</div>
          </button>
          <button 
            onClick={() => setActiveTab('rekap')}
            className={`pb-3 px-4 font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === 'rekap' ? 'text-red-600 border-red-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
          >
            <div className="flex items-center gap-2"><History className="w-4 h-4"/> Rekap Undangan</div>
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`pb-3 px-4 font-medium transition-colors whitespace-nowrap border-b-2 ${activeTab === 'users' ? 'text-red-600 border-red-600' : 'text-gray-500 border-transparent hover:text-gray-700'}`}
          >
            <div className="flex items-center gap-2"><UserPlus className="w-4 h-4"/> User Manager</div>
          </button>
        </div>

        {activeTab === 'event' && (
          <div className="bg-white p-6 rounded-xl shadow-sm max-w-3xl">
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-gray-800">Konten Undangan Live</h3>
               <button 
                 type="button"
                 onClick={() => {
                   const latestLoc = eventsHistory.length > 0 ? eventsHistory[0] : eventForm;
                   setEventForm(prev => ({ 
                     id: '', title: '', date: '', time: '', description: '', 
                     location: latestLoc.location || prev.location || '', 
                     backgroundImage: prev.backgroundImage, 
                     latitude: latestLoc.latitude || prev.latitude || '', 
                     longitude: latestLoc.longitude || prev.longitude || '' 
                   }))
                 }}
                 className="flex items-center gap-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
               >
                 <PlusCircle className="w-4 h-4" /> Buat Kegiatan Baru
               </button>
            </div>
            {msg && <Notification message={msg} type={msg.includes('Gagal') ? 'error' : 'success'} />}
            
            <form onSubmit={handleUpdateEvent} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Nama Kegiatan (Judul Utama)</label>
                <input type="text" className="w-full border p-2.5 sm:p-3 rounded-lg focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none transition-all text-sm sm:text-base" value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                   <ImageIcon className="w-4 h-4"/> Foto Background
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    placeholder="URL Foto atau Upload dari Perangkat ->" 
                    className="flex-1 w-full border p-2.5 sm:p-3 rounded-lg focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none transition-all text-sm sm:text-base" 
                    value={eventForm.backgroundImage || ''} 
                    onChange={e => setEventForm({...eventForm, backgroundImage: e.target.value})} 
                  />
                  <label className={`cursor-pointer bg-gray-100 hover:bg-gray-200 border border-gray-300 text-gray-700 px-4 py-2.5 sm:py-3 rounded-lg font-medium flex items-center justify-center transition-colors text-sm sm:text-base whitespace-nowrap ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                    {isUploading ? 'Mengunggah...' : 'Pilih Foto'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Hari & Tanggal</label>
                  <input type="date" className="w-full border p-2.5 sm:p-3 rounded-lg focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none transition-all text-sm sm:text-base bg-white" value={eventForm.date} onChange={e => setEventForm({...eventForm, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Jam Pelaksanaan</label>
                  <input type="time" className="w-full border p-2.5 sm:p-3 rounded-lg focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none transition-all text-sm sm:text-base bg-white" value={eventForm.time} onChange={e => setEventForm({...eventForm, time: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Lokasi Lengkap</label>
                <input type="text" className="w-full border p-2.5 sm:p-3 rounded-lg focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none transition-all text-sm sm:text-base" value={eventForm.location} onChange={e => setEventForm({...eventForm, location: e.target.value})} />
              </div>

              {/* PERBAIKAN: Tampilan Peta Interaktif */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="col-span-1 sm:col-span-2 flex justify-between items-center mb-1">
                   <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <MapIcon className="w-4 h-4 text-red-600"/> Koordinat Peta
                   </div>
                   <button 
                     type="button" 
                     onClick={handleGetCurrentLocation}
                     className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
                   >
                     <MapPin className="w-3 h-3" /> Lokasi Saya
                   </button>
                </div>

                <div className="col-span-1 sm:col-span-2 h-64 w-full rounded-xl overflow-hidden border border-gray-300 relative z-0 mb-2">
                  <LocationPickerIframe 
                    position={{ latitude: eventForm.latitude, longitude: eventForm.longitude }}
                    setPosition={(pos) => setEventForm({...eventForm, latitude: pos.latitude, longitude: pos.longitude})}
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Latitude</label>
                  <input 
                    type="text" 
                    placeholder="-6.200000"
                    className="w-full border p-2 rounded focus:ring-1 focus:ring-red-500 outline-none text-sm transition-all bg-white" 
                    value={eventForm.latitude || ''} 
                    onChange={e => setEventForm({...eventForm, latitude: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Longitude</label>
                  <input 
                    type="text" 
                    placeholder="106.816666"
                    className="w-full border p-2 rounded focus:ring-1 focus:ring-red-500 outline-none text-sm transition-all bg-white" 
                    value={eventForm.longitude || ''} 
                    onChange={e => setEventForm({...eventForm, longitude: e.target.value})} 
                  />
                </div>
                <p className="col-span-1 sm:col-span-2 text-[10px] text-gray-400 mt-[-5px] italic">
                  * Anda bisa mengklik titik pada peta di atas untuk mengisi koordinat secara otomatis.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Deskripsi & Pesan</label>
                <textarea rows="5" className="w-full border p-2.5 sm:p-3 rounded-lg focus:ring-2 focus:ring-red-200 focus:border-red-500 outline-none transition-all text-sm sm:text-base custom-scrollbar" value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} />
              </div>
              <div className="pt-2 sm:pt-4">
                <button type="submit" className="w-full sm:w-auto bg-red-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-red-700 shadow-lg text-sm sm:text-base transition-colors">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'rekap' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Riwayat & Daftar Kegiatan</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nama Kegiatan</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Tanggal</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Lokasi</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                  {eventsHistory.map((evt) => {
                    const isActive = eventForm.id === evt.id;
                    return (
                      <tr key={evt.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">
                          {evt.title}
                          {isActive && <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3"/> Aktif</span>}
                        </td>
                        <td className="px-6 py-4 text-gray-500">{formatDateUI(evt.date)}</td>
                        <td className="px-6 py-4 text-gray-500 truncate max-w-[150px]">{evt.location}</td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          <button 
                            onClick={() => { setEventForm(evt); setActiveTab('event'); }}
                            className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded transition-colors font-medium"
                          >
                            Edit
                          </button>
                          {!isActive ? (
                            <button 
                              onClick={() => handleSetMainEvent(evt)}
                              className="text-green-600 hover:bg-green-50 px-3 py-1 rounded transition-colors font-medium"
                            >
                              Jadikan Aktif
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleDeleteEvent(evt.id, isActive)}
                              disabled={isActive}
                              className={`px-3 py-1 rounded transition-colors font-medium text-gray-400 cursor-not-allowed`}
                              title="Kegiatan aktif tidak dapat dihapus"
                            >
                              Hapus
                            </button>
                          )}
                          {!isActive && (
                            <button 
                              onClick={() => handleDeleteEvent(evt.id, isActive)}
                              className="text-red-600 hover:bg-red-50 px-3 py-1 rounded transition-colors font-medium"
                              title="Hapus Kegiatan"
                            >
                              Hapus
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {eventsHistory.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-10 text-center text-gray-500 italic">Belum ada riwayat kegiatan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'rsvp' && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100">
            <div className="p-4 bg-gray-50 border-b flex justify-between items-center flex-wrap gap-4">
              <h3 className="font-bold text-gray-800 flex items-center gap-2">
                 Daftar Tamu Masuk 
                 <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">{rsvpList.length}</span>
              </h3>
              {GOOGLE_SCRIPT_URL !== "URL_GOOGLE_SCRIPT_ANDA_DISINI" && (
                <div className="text-xs text-green-700 bg-green-100 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 border border-green-200">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Terhubung ke Google Sheets
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nama Lengkap</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Instansi</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Pesan</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                  {rsvpList.map((rsvp) => (
                    <tr key={rsvp.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{rsvp.name}</td>
                      <td className="px-6 py-4 text-gray-500">{rsvp.institution}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          rsvp.status === 'Hadir' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {rsvp.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-500 max-w-xs truncate">{rsvp.message || '-'}</td>
                    </tr>
                  ))}
                  {rsvpList.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-10 text-center text-gray-500 italic">Belum ada data konfirmasi masuk.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="bg-white p-6 rounded-xl shadow-sm max-w-lg">
             <h3 className="text-lg font-bold mb-4 text-gray-800 flex items-center gap-2">
               <UserPlus className="w-5 h-5"/> Tambah Admin Baru
             </h3>
             <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-sm text-yellow-800">
               <strong>Perhatian:</strong> Menambahkan user akan otomatis membuat Anda login sebagai user baru tersebut.
             </div>
             
             <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Admin Baru</label>
                  <input 
                    type="email" 
                    required
                    className="w-full border p-2 rounded"
                    placeholder="nama@smanel.com"
                    value={newUserEmail} 
                    onChange={e => setNewUserEmail(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input 
                    type="password" 
                    required
                    minLength="6"
                    className="w-full border p-2 rounded"
                    placeholder="Minimal 6 karakter"
                    value={newUserPass} 
                    onChange={e => setNewUserPass(e.target.value)} 
                  />
                </div>
                <button type="submit" className="w-full bg-gray-800 text-white py-2 rounded hover:bg-black transition-colors">
                  Daftarkan Admin
                </button>
             </form>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * ------------------------------------------------------------------
 * 8. APP ROUTING
 * ------------------------------------------------------------------
 */
function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen flex flex-col font-sans text-gray-800">
          <Navbar />
          <div className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/rsvp" element={<RsvpPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
            </Routes>
          </div>
          <footer className="bg-white border-t py-8 text-center text-sm text-gray-500">
            <p className="font-semibold text-gray-700">&copy; {new Date().getFullYear()} PMR SMANEL</p>
            <p className="mt-1 italic">"Siamo Tutti Fratelli"</p>
          </footer>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;