import * as moment from 'moment';

export async function handler(event: any) {
  const response = {
    statusCode: 200,
    body: JSON.stringify(`Hello from Lambda! moment: ${moment().format('MMMM Do YYYY, h:mm:ss a')}`),
  };
  return response;
}
