import { createContext, useContext, useState, type ReactNode } from 'react';

const en = {
  home: 'Home',
  search: 'Search',
  albums: 'Albums',
  artists: 'Artists',
  playlists: 'Playlists',
  favorites: 'Liked songs',
  settings: 'Settings',
  library: 'Library',
  goodMorning: 'Good morning',
  goodAfternoon: 'Good afternoon',
  goodEvening: 'Good evening',
  recentlyPlayed: 'Recently played',
  recentlyAdded: 'Recently added',
  discover: 'Rediscover',
  mostPlayed: 'Your most played',
  play: 'Play',
  pause: 'Pause',
  shuffle: 'Shuffle',
  repeat: 'Repeat',
  next: 'Next',
  previous: 'Previous',
  queue: 'Queue',
  nowPlaying: 'Now playing',
  upNext: 'Up next',
  clearQueue: 'Clear',
  volume: 'Volume',
  mute: 'Mute',
  playNext: 'Play next',
  addToQueue: 'Add to queue',
  addToPlaylist: 'Add to playlist',
  goToAlbum: 'Go to album',
  goToArtist: 'Go to artist',
  removeFromPlaylist: 'Remove from playlist',
  moveUp: 'Move up',
  moveDown: 'Move down',
  like: 'Like',
  unlike: 'Remove from liked songs',
  more: 'More',
  title: 'Title',
  album: 'Album',
  artist: 'Artist',
  playlist: 'Playlist',
  duration: 'Duration',
  sortName: 'Name',
  sortRecent: 'Recently added',
  sortYear: 'Year',
  sortRandom: 'Random',
  songs: (n: number) => `${n} ${n === 1 ? 'song' : 'songs'}`,
  albumCount: (n: number) => `${n} ${n === 1 ? 'album' : 'albums'}`,
  popular: 'Popular',
  discography: 'Discography',
  appearsOn: 'Appears on',
  searchPlaceholder: 'What do you want to listen to?',
  searchHint: 'Search your library by song, album or artist.',
  noResults: (q: string) => `No results for “${q}”`,
  songsHeading: 'Songs',
  newPlaylist: 'New playlist',
  playlistName: 'Playlist name',
  create: 'Create',
  cancel: 'Cancel',
  save: 'Save',
  rename: 'Rename',
  delete: 'Delete',
  deletePlaylistConfirm: (name: string) => `Delete “${name}”? This cannot be undone.`,
  emptyPlaylist: 'This playlist is empty. Add songs from any track menu.',
  emptyFavorites: 'Songs you like will appear here. Tap the heart next to any song.',
  emptyLibrary: 'Your library is empty',
  emptyLibraryHint: 'Put music files into your music folder and run a scan from Settings.',
  openSettings: 'Open settings',
  noPlaylists: 'You have no playlists yet.',
  added: 'Added',
  loading: 'Loading…',
  error: 'Something went wrong.',
  notFound: 'Not found.',
  retry: 'Retry',
  welcome: 'Welcome to Plak',
  setupIntro: 'Create the admin account for this server.',
  signIn: 'Sign in',
  signInIntro: 'Sign in to your music.',
  createAccount: 'Create account',
  username: 'Username',
  password: 'Password',
  passwordHint: 'At least 8 characters.',
  logout: 'Sign out',
  invalid_credentials: 'Wrong username or password.',
  too_many_attempts: 'Too many attempts. Try again in 15 minutes.',
  username_taken: 'That username is taken.',
  wrong_password: 'Current password is wrong.',
  validation: 'Check the fields and try again.',
  libraryStats: 'Library',
  tracksStat: 'Songs',
  albumsStat: 'Albums',
  artistsStat: 'Artists',
  hoursStat: 'Hours',
  sizeStat: 'Size',
  musicFolder: 'Music folder',
  scanNow: 'Scan library',
  scanning: 'Scanning…',
  scanResult: (seen: number, added: number, updated: number, removed: number) =>
    `${seen} files checked · ${added} added · ${updated} updated · ${removed} removed`,
  lastScan: 'Last scan',
  language: 'Language',
  account: 'Account',
  changePassword: 'Change password',
  currentPassword: 'Current password',
  newPassword: 'New password',
  passwordChanged: 'Password changed. Other devices were signed out.',
  users: 'Users',
  usersHint: 'Give family and friends their own account, playlists and history.',
  addUser: 'Add user',
  admin: 'Admin',
  you: 'you',
  signedInAs: (name: string) => `Signed in as ${name}`,
  about: 'Plak is open source software.',
};

type Dictionary = typeof en;

const tr: Dictionary = {
  home: 'Ana sayfa',
  search: 'Ara',
  albums: 'Albümler',
  artists: 'Sanatçılar',
  playlists: 'Çalma listeleri',
  favorites: 'Beğenilen şarkılar',
  settings: 'Ayarlar',
  library: 'Kitaplık',
  goodMorning: 'Günaydın',
  goodAfternoon: 'İyi günler',
  goodEvening: 'İyi akşamlar',
  recentlyPlayed: 'Son çalınanlar',
  recentlyAdded: 'Yeni eklenenler',
  discover: 'Yeniden keşfet',
  mostPlayed: 'En çok dinlediklerin',
  play: 'Çal',
  pause: 'Duraklat',
  shuffle: 'Karıştır',
  repeat: 'Tekrarla',
  next: 'Sonraki',
  previous: 'Önceki',
  queue: 'Sıra',
  nowPlaying: 'Şimdi çalıyor',
  upNext: 'Sıradakiler',
  clearQueue: 'Temizle',
  volume: 'Ses',
  mute: 'Sessiz',
  playNext: 'Sonra çal',
  addToQueue: 'Sıraya ekle',
  addToPlaylist: 'Çalma listesine ekle',
  goToAlbum: 'Albüme git',
  goToArtist: 'Sanatçıya git',
  removeFromPlaylist: 'Listeden çıkar',
  moveUp: 'Yukarı taşı',
  moveDown: 'Aşağı taşı',
  like: 'Beğen',
  unlike: 'Beğenilenlerden çıkar',
  more: 'Diğer',
  title: 'Başlık',
  album: 'Albüm',
  artist: 'Sanatçı',
  playlist: 'Çalma listesi',
  duration: 'Süre',
  sortName: 'Ad',
  sortRecent: 'Yeni eklenen',
  sortYear: 'Yıl',
  sortRandom: 'Rastgele',
  songs: (n) => `${n} şarkı`,
  albumCount: (n) => `${n} albüm`,
  popular: 'Popüler',
  discography: 'Diskografi',
  appearsOn: 'Yer aldığı albümler',
  searchPlaceholder: 'Ne dinlemek istersin?',
  searchHint: 'Kitaplığında şarkı, albüm ya da sanatçı ara.',
  noResults: (q) => `“${q}” için sonuç yok`,
  songsHeading: 'Şarkılar',
  newPlaylist: 'Yeni çalma listesi',
  playlistName: 'Liste adı',
  create: 'Oluştur',
  cancel: 'Vazgeç',
  save: 'Kaydet',
  rename: 'Yeniden adlandır',
  delete: 'Sil',
  deletePlaylistConfirm: (name) => `“${name}” silinsin mi? Bu geri alınamaz.`,
  emptyPlaylist: 'Bu liste boş. Herhangi bir şarkının menüsünden ekleyebilirsin.',
  emptyFavorites: 'Beğendiğin şarkılar burada görünür. Şarkının yanındaki kalbe dokun.',
  emptyLibrary: 'Kitaplığın boş',
  emptyLibraryHint: 'Müzik dosyalarını müzik klasörüne koy ve Ayarlar’dan tarama başlat.',
  openSettings: 'Ayarları aç',
  noPlaylists: 'Henüz çalma listen yok.',
  added: 'Eklendi',
  loading: 'Yükleniyor…',
  error: 'Bir şeyler ters gitti.',
  notFound: 'Bulunamadı.',
  retry: 'Tekrar dene',
  welcome: 'Plak’a hoş geldin',
  setupIntro: 'Bu sunucunun yönetici hesabını oluştur.',
  signIn: 'Giriş yap',
  signInIntro: 'Müziğine giriş yap.',
  createAccount: 'Hesap oluştur',
  username: 'Kullanıcı adı',
  password: 'Şifre',
  passwordHint: 'En az 8 karakter.',
  logout: 'Çıkış yap',
  invalid_credentials: 'Kullanıcı adı ya da şifre yanlış.',
  too_many_attempts: 'Çok fazla deneme. 15 dakika sonra tekrar dene.',
  username_taken: 'Bu kullanıcı adı alınmış.',
  wrong_password: 'Mevcut şifre yanlış.',
  validation: 'Alanları kontrol edip tekrar dene.',
  libraryStats: 'Kitaplık',
  tracksStat: 'Şarkı',
  albumsStat: 'Albüm',
  artistsStat: 'Sanatçı',
  hoursStat: 'Saat',
  sizeStat: 'Boyut',
  musicFolder: 'Müzik klasörü',
  scanNow: 'Kitaplığı tara',
  scanning: 'Taranıyor…',
  scanResult: (seen, added, updated, removed) =>
    `${seen} dosya kontrol edildi · ${added} eklendi · ${updated} güncellendi · ${removed} silindi`,
  lastScan: 'Son tarama',
  language: 'Dil',
  account: 'Hesap',
  changePassword: 'Şifre değiştir',
  currentPassword: 'Mevcut şifre',
  newPassword: 'Yeni şifre',
  passwordChanged: 'Şifre değişti. Diğer cihazlardan çıkış yapıldı.',
  users: 'Kullanıcılar',
  usersHint: 'Ailene ve arkadaşlarına kendi hesabını, listelerini ve geçmişini ver.',
  addUser: 'Kullanıcı ekle',
  admin: 'Yönetici',
  you: 'sen',
  signedInAs: (name) => `${name} olarak giriş yapıldı`,
  about: 'Plak açık kaynak bir yazılımdır.',
};

export const languages = { en, tr };
export type Language = keyof typeof languages;

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem('plak:language');
    if (saved === 'en' || saved === 'tr') return saved;
  } catch {
    // Storage can be unavailable (private mode); fall through.
  }
  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

const I18nContext = createContext<{ t: Dictionary; language: Language; setLanguage: (l: Language) => void } | null>(
  null,
);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  document.documentElement.lang = language;
  const setLanguage = (next: Language) => {
    setLanguageState(next);
    try {
      localStorage.setItem('plak:language', next);
    } catch {
      // Ignore: the choice just won't persist.
    }
  };
  return <I18nContext.Provider value={{ t: languages[language], language, setLanguage }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function formatLongDuration(seconds: number, language: Language): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (language === 'tr') return h > 0 ? `${h} sa ${m} dk` : `${m} dk`;
  return h > 0 ? `${h} hr ${m} min` : `${m} min`;
}
