import axios from 'axios';

export async function getPhotos({ userId, accessToken }) {
  const images = [];
  const total = 24;
  let stop = false;
  let response, url = `https://graph.instagram.com/${userId}/media?fields=id,media_type,media_url&limit=2&access_token=${accessToken}`;
  do {
    response = await axios({
      method: "get",
      url,
      headers: { "Content-Type": 'application/x-www-form-urlencoded' },
    });
    const results = response.data.data.filter(d => ['CAROUSEL_ALBUM', 'IMAGE'].includes(d.media_type)).map(d => d.media_url)
    images.push(...results);
    if (images.length >= total) {
      console.log('reached');
      stop = true;
    } else if (!response.data.paging.next) {
      console.log('no next');
      stop = true;
    } else {
      url = response.data.paging.next
    }

  } while(!stop);
  return images
}

const credentials = {
  access_token: 'IGQVJYUHhPZAGU2MTYwTm5yTnkyOWI0b3F4M09yWFR2NnhKc2xkSVl4TWFab1BnYng0MEoxVmEwenI1eE5MMXJjWG1lSVRyZAnRRbWc2SG1yU0RNU3MycFU1TFVDNS1aS2ROMlhENkFWcmJyR01GUUVEYXg1dFIwSlVhdWxB',
  user_id: 17841403371258294
}

async function main() {
  const photos = await getPhotos({ userId: credentials.user_id, accessToken: credentials.access_token })
  console.log(photos.length);
}

try {
  (async () => {
    await main()
    process.exit(0)
  })();
} catch (error) {
  console.trace(error)
  process.exit(1)
}

async function asyncForEach<T>(array: T[], callback: (t: T, i: number, a: T[]) => any): Promise<void> {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

async function asyncMap<T, R = any>(array: T[], callback: (t: T, i: number, a: T[]) => Promise<R>): Promise<R[]> {
  const result = [];
  await asyncForEach(array, async (item, i, a) => {
    result.push(await callback(item, i, a));
  });
  return result;
}
