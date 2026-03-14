export const fetchAniList = async (query: string, variables: any) => {
  const response = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error('AniList API Error');
  return response.json();
};

export const fetchJikan = async (endpoint: string) => {
  const response = await fetch(`https://api.jikan.moe/v4${endpoint}`);
  if (!response.ok) throw new Error('Jikan API Error');
  return response.json();
};

export const getTrendingAnime = async (page: number = 1, nsfwEnabled: boolean = false) => {
  const query = `
    query ($page: Int, $isAdult: Boolean) {
      Page(page: $page, perPage: 15) {
        media(sort: TRENDING_DESC, type: ANIME, isAdult: $isAdult) {
          id
          title { romaji english }
          coverImage { large }
          episodes
          averageScore
          genres
        }
      }
    }
  `;
  try {
    const data = await fetchAniList(query, { page, isAdult: nsfwEnabled });
    return data.data.Page.media;
  } catch (error) {
    const data = await fetchJikan(`/top/anime?filter=bypopularity&limit=15&page=${page}`);
    return data.data.map((item: any) => ({
      id: item.mal_id,
      title: { romaji: item.title, english: item.title_english },
      coverImage: { large: item.images.jpg.large_image_url },
      episodes: item.episodes,
      averageScore: item.score * 10,
      genres: item.genres.map((g: any) => g.name),
    }));
  }
};

export const getTrendingManga = async (page: number = 1, nsfwEnabled: boolean = false) => {
  const query = `
    query ($page: Int, $isAdult: Boolean) {
      Page(page: $page, perPage: 15) {
        media(sort: TRENDING_DESC, type: MANGA, countryOfOrigin: "JP", isAdult: $isAdult) {
          id
          title { romaji english }
          coverImage { large }
          chapters
          averageScore
          genres
        }
      }
    }
  `;
  const data = await fetchAniList(query, { page, isAdult: nsfwEnabled });
  return data.data.Page.media;
};

export const getTrendingManhwa = async (page: number = 1, nsfwEnabled: boolean = false) => {
  const query = `
    query ($page: Int, $isAdult: Boolean) {
      Page(page: $page, perPage: 15) {
        media(sort: TRENDING_DESC, type: MANGA, countryOfOrigin: "KR", isAdult: $isAdult) {
          id
          title { romaji english }
          coverImage { large }
          chapters
          averageScore
          genres
        }
      }
    }
  `;
  const data = await fetchAniList(query, { page, isAdult: nsfwEnabled });
  return data.data.Page.media;
};

export const getMediaDetails = async (id: number, type: string) => {
  const query = `
    query ($id: Int, $type: MediaType) {
      Media(id: $id, type: $type) {
        id
        title { romaji english native }
        coverImage { extraLarge large }
        bannerImage
        description(asHtml: false)
        averageScore
        genres
        status
        episodes
        chapters
        trailer { id site }
        characters(sort: ROLE, perPage: 12) {
          edges {
            role
            node {
              id
              name { full }
              image { large }
            }
          }
        }
        recommendations(sort: RATING_DESC, perPage: 10) {
          nodes {
            mediaRecommendation {
              id
              title { romaji english }
              coverImage { large }
              type
              averageScore
            }
          }
        }
      }
    }
  `;
  const data = await fetchAniList(query, { id: Number(id), type: type.toUpperCase() });
  return data.data.Media;
};

export const getRandomCharacter = async (bannerType: 'standard' | 'premium' | 'abyss' = 'standard') => {
  let sort = 'FAVOURITES_DESC';
  let randomPage = Math.floor(Math.random() * 500) + 1; // Standard: wide variety

  if (bannerType === 'abyss') {
    // Only top characters
    randomPage = Math.floor(Math.random() * 10) + 1;
  } else if (bannerType === 'premium') {
    randomPage = Math.floor(Math.random() * 50) + 1;
  }

  const query = `
    query ($page: Int, $sort: [CharacterSort]) {
      Page(page: $page, perPage: 1) {
        characters(sort: $sort) {
          id
          name { full }
          image { large }
          favourites
          media(page: 1, perPage: 1) {
            nodes { 
              title { romaji } 
              type
              countryOfOrigin
            }
          }
        }
      }
    }
  `;
  const data = await fetchAniList(query, { page: randomPage, sort: [sort] });
  return data.data.Page.characters[0];
};
