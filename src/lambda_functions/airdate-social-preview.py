/**
 * Lambda Function: Social Media Preview Handler
 * 
 * Purpose: Serve details pages with dynamic Open Graph meta tags for social media bots
 * Detects: LinkedIn, Facebook, Twitter, Slack bots and serves pre-rendered HTML
 * 
 * Deploy this Lambda function behind API Gateway at /details.html route
 */

const AWS = require('aws-sdk');
const https = require('https');

// Your API base URL
const API_BASE = 'https://21ave5trw7.execute-api.us-east-1.amazonaws.com';

// Social media bot user agents
const SOCIAL_BOTS = [
    'LinkedInBot',
    'facebookexternalhit',
    'Twitterbot',
    'Slackbot',
    'WhatsApp',
    'TelegramBot',
    'Discordbot',
    'SkypeUriPreview'
];

// Check if request is from a social media bot
function isSocialBot(userAgent) {
    if (!userAgent) return false;
    return SOCIAL_BOTS.some(bot => userAgent.includes(bot));
}

// Fetch show details from API
async function fetchShowDetails(showId) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            tmdb_id: parseInt(showId),
            page: 1,
            per_page: 1
        });

        const options = {
            hostname: API_BASE.replace('https://', '').split('/')[0],
            path: '/get-premieres',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    const body = response.body ? 
                        (typeof response.body === 'string' ? JSON.parse(response.body) : response.body) : 
                        response;
                    
                    if (body.results && body.results.length > 0) {
                        resolve(body.results[0]);
                    } else {
                        reject(new Error('Show not found'));
                    }
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Format date
function formatDate(dateString) {
    if (!dateString || dateString === 'TBA' || dateString === 'TBD') {
        return 'TBA';
    }
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    } catch (e) {
        return dateString;
    }
}

// Generate HTML with dynamic OG tags
function generateHTML(show) {
    const title = show.title || show.seriesTitle;
    const description = show.overview || show.description || 'Track this premiere on AirDate';
    const premiereDate = show.premiereDate || show.premiere;
    const network = show.network || 'Streaming';
    const poster = show.poster || 'https://airdate.tv/assets/images/official-airdate-logo.png';
    const showId = show.id;
    
    const fullTitle = `${title} - ${network} | AirDate`;
    
    let fullDescription = description.substring(0, 155);
    if (premiereDate && premiereDate !== 'TBA' && premiereDate !== 'TBD') {
        fullDescription = `Premieres ${formatDate(premiereDate)} on ${network}. ${fullDescription}`;
    }
    
    const url = `https://airdate.tv/details.html?show_id=${showId}&title=${encodeURIComponent(title)}`;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${fullTitle}</title>
  
  <!-- Open Graph / Social Media Meta Tags -->
  <meta property="og:site_name" content="AirDate" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${fullTitle}" />
  <meta property="og:description" content="${fullDescription}" />
  <meta property="og:image" content="${poster}" />
  <meta property="og:url" content="${url}" />
  
  <!-- Twitter Card Meta Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${fullTitle}" />
  <meta name="twitter:description" content="${fullDescription}" />
  <meta name="twitter:image" content="${poster}" />
  
  <!-- Redirect non-bots to actual page -->
  <meta http-equiv="refresh" content="0;url=${url}" />
  
  <script>
    // Immediate redirect for JavaScript-enabled browsers
    window.location.href = '${url}';
  </script>
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <p>Network: ${network}</p>
  ${premiereDate && premiereDate !== 'TBA' ? `<p>Premieres: ${formatDate(premiereDate)}</p>` : ''}
  <p><a href="${url}">View on AirDate</a></p>
</body>
</html>`;
}

// Lambda handler
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event));
    
    // Get user agent from headers
    const userAgent = event.headers?.['User-Agent'] || event.headers?.['user-agent'] || '';
    console.log('User-Agent:', userAgent);
    
    // Get show_id from query parameters
    const showId = event.queryStringParameters?.show_id;
    
    if (!showId) {
        return {
            statusCode: 400,
            headers: { 'Content-Type': 'text/html' },
            body: '<h1>Error: Missing show_id parameter</h1>'
        };
    }
    
    // Check if this is a social media bot
    const isBot = isSocialBot(userAgent);
    console.log('Is social bot:', isBot);
    
    if (!isBot) {
        // Not a bot - redirect to actual page
        const title = event.queryStringParameters?.title || 'Show Details';
        const redirectUrl = `https://airdate.tv/details.html?show_id=${showId}&title=${encodeURIComponent(title)}`;
        
        return {
            statusCode: 302,
            headers: {
                'Location': redirectUrl,
                'Cache-Control': 'no-cache'
            },
            body: ''
        };
    }
    
    // Social media bot - serve pre-rendered HTML with OG tags
    try {
        const show = await fetchShowDetails(showId);
        const html = generateHTML(show);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/html',
                'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
            },
            body: html
        };
    } catch (error) {
        console.error('Error fetching show:', error);
        
        return {
            statusCode: 404,
            headers: { 'Content-Type': 'text/html' },
            body: '<h1>Show not found</h1>'
        };
    }
};