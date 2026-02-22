export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  website: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Cover {
  id: string;
  user_id: string;
  title: string;
  artist: string;
  year: number | null;
  tags: string[];
  storage_path: string;
  image_url: string;
  download_count: number;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  // joined via select
  profiles?: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
  favorites?: { id: string }[];
}

export interface Favorite {
  id: string;
  user_id: string;
  cover_id: string;
  created_at: string;
}

export interface Download {
  id: string;
  user_id: string | null;
  cover_id: string;
  created_at: string;
}
