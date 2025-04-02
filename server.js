const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');
const axios = require('axios');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 4000;

app.use(cors({ origin: '*' }));
app.use(express.json());

const cache = new NodeCache({ 
  stdTTL: 2, // Cache for 2 seconds instead of 15
  checkperiod: 1, // Check expired keys every 1 second
  useClones: false // Don't clone data (faster)
});

// ✅ Rotate through tokens
const AUTH_TOKENS = [
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJDb2RlIjoiQzEwMTAxMDJNMDkiLCJ0b2tlbklkIjoiMjA4MTlhYTJhYTY3NWI1NjI0ZGNiYmViMzQ1ODRkYzYyOTVkODJiM2EwYjAxZmRmNDJhN2FiMWY3ODJiYjQ0MSIsImxvZ2luQ291bnRyeSI6IklOIiwic2Vzc2lvbklkIjoiYmUyMTM4Zjk0MjQ5OWU2NDg2MjkwYTgyYmY3OTUzZDRiZWJlMTQ4NjU4NDU3N2ViMWI5ODhmZTI1NDRkNmY5NCIsImFsbG93U2hha3RpUHJvIjpmYWxzZSwibGFzdExvZ2luVGltZSI6MTc0MzA2ODcyMjU1OCwibmJmIjoxNzQzMDY4NzI3LCJsb2dpbk5hbWUiOiJkaXMuZGVtb2Q4IiwibG9naW5JUCI6IjE1Mi41OC4yNDQuMjQ2IiwidGhlbWUiOiJsb3R1cyIsImV4cCI6MTc0MzQxNDMyNywiaWF0IjoxNzQzMDY4NzI3LCJtZW1iZXJJZCI6NTEzNzEwLCJ1cGxpbmVzIjp7IkNPWSI6eyJ1c2VySWQiOjEsInVzZXJDb2RlIjoiYWRtaW4udXNlciJ9LCJTTUEiOnsidXNlcklkIjo1MTMyOTcsInVzZXJDb2RlIjoiQzEwMSJ9LCJNQSI6eyJ1c2VySWQiOjUxMzY5MSwidXNlckNvZGUiOiJDMTAxMDEifSwiQWdlbnQiOnsidXNlcklkIjo1MTM2OTQsInVzZXJDb2RlIjoiQzEwMTAxMDIifX0sImN1cnJlbmN5IjoiSU5SIiwiaXNEZW1vIjp0cnVlLCJtYSI6bnVsbCwiYiI6bnVsbCwicyI6bnVsbCwiYyI6bnVsbH0.GtHiTkROKQb9xgn3BGiZ7bLbY0bATzov-dWV2jfP64Q',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJDb2RlIjoiSTRfLTAxMDFNNFAiLCJ0b2tlbklkIjoiYjg1M2FkMTAyODE4YTk5N2M1YWZhMjBlOTZjNWQ3NzBiMzQwMDg1YWNlMTQ2ZThjNzdmYmI3ZGU5OGUxYWI0NCIsImxvZ2luQ291bnRyeSI6IklOIiwic2Vzc2lvbklkIjoiNWU0ZTM0MWY5ZmZlYWQzMzIwMWI3OTJiMThiNDkxOTE3MzdmYTZkOWNkNWFhNjA0MGFkOGZjODA2NjQ5NmE2YyIsImFsbG93U2hha3RpUHJvIjpmYWxzZSwibGFzdExvZ2luVGltZSI6MTc0MjgzNTk1NTAxNSwibmJmIjoxNzQyODQyNDYwLCJsb2dpbk5hbWUiOiJkaXMubWFoZXNoODUyIiwibG9naW5JUCI6IjE1Mi41OC4xOTIuNCIsInRoZW1lIjoibG90dXMiLCJleHAiOjE3NDMxODgwNjAsImlhdCI6MTc0Mjg0MjQ2MCwibWVtYmVySWQiOjkwODUzMDIsInVwbGluZXMiOnsiQ09ZIjp7InVzZXJJZCI6MSwidXNlckNvZGUiOiJhZG1pbi51c2VyIn0sIlNNQSI6eyJ1c2VySWQiOjAsInVzZXJDb2RlIjpudWxsfSwiTUEiOnsidXNlcklkIjo2NTcxOTUsInVzZXJDb2RlIjoiSTRfLTAxIn0sIkFnZW50Ijp7InVzZXJJZCI6NjU3MjAxLCJ1c2VyQ29kZSI6Ikk0Xy0wMTAxIn19LCJjdXJyZW5jeSI6IklOUiIsImlzRGVtbyI6ZmFsc2UsIm1hIjpudWxsLCJiIjpudWxsLCJzIjpudWxsLCJjIjpudWxsfQ.oAEhUVj0-t3kVTG4ggOj4Dueg02wd-kKxx5Z2_joYhU',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZW1iZXJDb2RlIjoiSTRfLTAxMDFNNE4iLCJ0b2tlbklkIjoiMzgwM2U0NjlkMjhkMTcxMjMyZDgwMTE1YmUwZjU2YmExMzAwN2Y2ZmM4NjVlZjcxN2M0YWE3MjhkNWE5YjRlOSIsImxvZ2luQ291bnRyeSI6IklOIiwic2Vzc2lvbklkIjoiZWVkMmQ2YzBlODdhMmFmNjE0MmU1NmZkYTQzNmNkMWE4NzhjZjU3MGQ2MzhmNWMwNGFhODg4ZmU5YWMxZDY5OCIsImFsbG93U2hha3RpUHJvIjpmYWxzZSwibGFzdExvZ2luVGltZSI6MTc0Mjg0NDU2NjkyOSwibmJmIjoxNzQyODQ0NTczLCJsb2dpbk5hbWUiOiJkaXMuaGFyaXNoNDYiLCJsb2dpbklQIjoiMTUyLjU4LjE5Mi40IiwidGhlbWUiOiJsb3R1cyIsImV4cCI6MTc0MzE5MDE3MywiaWF0IjoxNzQyODQ0NTczLCJtZW1iZXJJZCI6OTA4NDc2NiwidXBsaW5lcyI6eyJDT1kiOnsidXNlcklkIjoxLCJ1c2VyQ29kZSI6ImFkbWluLnVzZXIifSwiU01BIjp7InVzZXJJZCI6MCwidXNlckNvZGUiOm51bGx9LCJNQSI6eyJ1c2VySWQiOjY1NzE5NSwidXNlckNvZGUiOiJJNF8tMDEifSwiQWdlbnQiOnsidXNlcklkIjo2NTcyMDEsInVzZXJDb2RlIjoiSTRfLTAxMDEifX0sImN1cnJlbmN5IjoiSU5SIiwiaXNEZW1vIjpmYWxzZSwibWEiOm51bGwsImIiOm51bGwsInMiOm51bGwsImMiOm51bGx9.au7E_2eWXM68d-4OPLpBUj5XLebGeBT7DxjyVCwbphw'
];

// User credentials for token renewal
const USER_CREDENTIALS = [
  { username: 'harish46', password: 'GK@789xe' },
  { username: 'mahesh852', password: 'PK@672km' },
  { username: 'ganesh658', password: 'FX@772cw' }
];

let tokenIndex = 0;

const getNextToken = () => {
  const token = AUTH_TOKENS[tokenIndex];
  tokenIndex = (tokenIndex + 1) % AUTH_TOKENS.length;
  return token;
};

// Token renewal function
const renewToken = async (credentials) => {
  try {
    console.log(`🔑 Attempting to renew token for ${credentials.username} via direct API call...`);
    
    // Make a direct API call to the login endpoint
    try {
      const response = await axios.post('https://gobook9.com/api/auth/b2b/login', {
        username: credentials.username,
        password: credentials.password
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'https://gobook9.com',
          'Referer': 'https://gobook9.com/login'
        }
      });
      
      // Check if the authorization header is present in the response
      const authToken = response.headers['authorization'];
      
      if (authToken) {
        console.log(`✅ Successfully obtained token from response headers for ${credentials.username}: ${authToken.substring(0, 30)}...`);
        return authToken;
      } else {
        console.error(`❌ No authorization header found in response for ${credentials.username}`);
        
        // Try to get token from response body as fallback
        if (response.data && response.data.result && response.data.result.token) {
          console.log(`✅ Successfully obtained token from response body for ${credentials.username}: ${response.data.result.token.substring(0, 30)}...`);
          return response.data.result.token;
        }
        
        return null;
      }
    } catch (error) {
      console.error(`❌ API call error for ${credentials.username}:`, error.message);
      
      // Log additional error details if available
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error('Headers:', JSON.stringify(error.response.headers, null, 2));
        console.error('Data:', JSON.stringify(error.response.data, null, 2));
      }
      
      return null;
    }
  } catch (error) {
    console.error(`❌ Error in renewToken for ${credentials.username}:`, error.message);
    return null;
  }
};

// Token manager
class TokenManager {
  constructor(initialTokens, credentials) {
    this.tokens = [...initialTokens];
    this.credentials = credentials;
    this.currentIndex = 0;
    this.renewalAttempts = {};
    this.lastRenewalTime = Date.now();
    
    // Start token renewal process immediately
    this.initialRenewal();
  }
  
  // Get next available token
  getToken() {
    const token = this.tokens[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
    
    // Check if token needs renewal - auto-check every 10 requests
    if (this.currentIndex % 10 === 0) {
      this.checkRenewalNeeded();
    }
    
    return token;
  }
  
  // Check if renewals are needed based on time
  checkRenewalNeeded() {
    const now = Date.now();
    const hoursSinceLastRenewal = (now - this.lastRenewalTime) / (1000 * 60 * 60);
    
    // If more than 1 hour since last renewal, renew all tokens
    if (hoursSinceLastRenewal > 1) {
      console.log(`⏰ It's been ${hoursSinceLastRenewal.toFixed(1)} hours since last renewal. Starting renewal...`);
      this.renewAllTokens();
    }
  }
  
  // Initial token renewal to get fresh tokens
  async initialRenewal() {
    console.log('🚀 Performing initial token renewal...');
    await this.renewAllTokens();
    
    // Then schedule regular renewals
    this.scheduleTokenRenewals();
  }
  
  // Replace token at index
  replaceToken(index, newToken) {
    if (newToken) {
      this.tokens[index] = newToken;
      console.log(`🔄 Token at index ${index} replaced`);
      // Update last renewal time when a token is successfully replaced
      this.lastRenewalTime = Date.now();
    }
  }
  
  // Schedule token renewals at regular intervals
  scheduleTokenRenewals() {
    // Renew tokens every 4 hours
    setInterval(() => {
      this.renewAllTokens();
    }, 4 * 60 * 60 * 1000);
  }
  
  // Renew all tokens
  async renewAllTokens() {
    console.log('🔄 Starting token renewal process...');
    
    let renewedAny = false;
    
    for (let i = 0; i < this.credentials.length; i++) {
      // Try to renew with puppeteer
      let newToken = await renewToken(this.credentials[i]);
      
      // If successful, update token
      if (newToken) {
        this.replaceToken(i, newToken);
        this.renewalAttempts[i] = 0; // Reset counter after successful renewal
        renewedAny = true;
      } else {
        console.log(`⚠️ Failed to renew token for ${this.credentials[i].username}, will retry later`);
      }
    }
    
    if (!renewedAny) {
      console.log('⚠️ Could not renew any tokens. Will try again after delay.');
      // Schedule a retry after 5 minutes
      setTimeout(() => {
        console.log('🔄 Retrying token renewal after delay...');
        this.renewAllTokens();
      }, 5 * 60 * 1000);
    } else {
      console.log('✅ Token renewal process completed with some success');
      this.lastRenewalTime = Date.now();
    }
  }
  
  // Handle token error/expiry
  async handleTokenError(tokenIndex) {
    // Track renewal attempts to avoid infinite loops
    if (!this.renewalAttempts[tokenIndex]) {
      this.renewalAttempts[tokenIndex] = 0;
    }
    
    this.renewalAttempts[tokenIndex]++;
    
    // Only try to renew 3 times max per token
    if (this.renewalAttempts[tokenIndex] <= 3) {
      console.log(`🔑 Token ${tokenIndex} seems expired. Attempting renewal (attempt ${this.renewalAttempts[tokenIndex]})...`);
      const newToken = await renewToken(this.credentials[tokenIndex]);
      if (newToken) {
        this.replaceToken(tokenIndex, newToken);
        this.renewalAttempts[tokenIndex] = 0; // Reset counter after successful renewal
        return true;
      }
    } else {
      console.log(`⚠️ Max renewal attempts reached for token ${tokenIndex}`);
      
      // Reset counter after some time (30 minutes)
      setTimeout(() => {
        console.log(`🔄 Resetting renewal counter for token ${tokenIndex}`);
        this.renewalAttempts[tokenIndex] = 0;
      }, 30 * 60 * 1000);
    }
    return false;
  }
}

// Initialize token manager
const tokenManager = new TokenManager(AUTH_TOKENS, USER_CREDENTIALS);

// Updated fetch data function with token renewal
const fetchData = async (url, retries = 3) => {
  // Get the current token index before getting a token
  const tokenIndex = tokenManager.currentIndex;
  
  // Get a token from the manager
  const currentToken = tokenManager.getToken();
  
  const options = {
    method: 'GET',
    headers: {
      'Authorization': currentToken,
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36 Edg/134.0.0.0',
      'Accept': 'application/json, text/plain, */*',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Origin': 'https://gobook9.com',
      'Referer': 'https://gobook9.com/sports/4'
    },
    timeout: 8000 // Increased timeout for more reliability
  };
  
  try {
    console.log(`🔄 Fetching data from: ${url} with token index: ${tokenIndex}`);
    const response = await axios(url, options);
    
    // If we get here, the request succeeded, but check if the response contains any error indicators
    if (response.data && (response.data.error || response.data.message === 'Unauthorized')) {
      console.log(`⚠️ API returned error: ${response.data.error || response.data.message}`);
      
      // Try to renew the token
      const renewed = await tokenManager.handleTokenError(tokenIndex);
      
      if (renewed && retries > 0) {
        console.log(`🔄 Retrying request with new token. Retries left: ${retries-1}`);
        return fetchData(url, retries - 1);
      }
    }
    
    return response.data;
  } catch (error) {
    // If unauthorized (401) or forbidden (403), try token renewal
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log(`⚠️ Token error (${error.response.status}) detected. Attempting renewal...`);
      
      // Try to renew the token that failed
      const renewed = await tokenManager.handleTokenError(tokenIndex);
      
      if (renewed && retries > 0) {
        console.log(`🔄 Retrying request with new token. Retries left: ${retries-1}`);
        // Wait briefly before retrying to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
        return fetchData(url, retries - 1);
      }
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      // Handle timeout errors
      console.log(`⚠️ Request timeout: ${error.message}`);
      if (retries > 0) {
        console.log(`🔄 Retrying after timeout. Retries left: ${retries-1}`);
        // Wait a bit longer before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchData(url, retries - 1);
      }
    }
    
    console.error(`❌ Fetch error: ${error.message}`);
    throw error;
  }
};

// ✅ Transform Market Data for Display
const transformMarketData = (market) => {
  if (market.mtype === 'MATCH_ODDS' || market.mtype === 'MATCH_ODDS_SB') {
    return {
      ...market,
      displayType: 'MATCH_ODDS',
      runners: market.runners.map(runner => ({
        ...runner,
        back: runner.back?.[0] || { price: 0, size: 0 },
        lay: runner.lay?.[0] || { price: 0, size: 0 }
      }))
    };
  }

  if (market.btype === 'LINE' || market.mtype === 'INNINGS_RUNS' || market.name.includes('Over') || market.name.includes('Lambi')) {
    return {
      ...market,
      displayType: 'FANCY',
      name: market.name,
      status: market.status,
      runners: [
        {
          no: {
            price: market.runners[0]?.back?.[0]?.price || 0,
            size: market.runners[0]?.back?.[0]?.size || 0
          },
          yes: {
            price: market.runners[0]?.lay?.[0]?.price || 0,
            size: market.runners[0]?.lay?.[0]?.size || 0
          }
        }
      ]
    };
  }

  if (market.name.toLowerCase().includes('toss')) {
    return {
      ...market,
      displayType: 'TOSS',
      runners: market.runners.map(runner => ({
        ...runner,
        back: runner.back?.[0] || { price: 0, size: 0 },
        lay: runner.lay?.[0] || { price: 0, size: 0 }
      }))
    };
  }

  return market;
};

// ✅ Endpoint: Get Match List
app.get('/api/match-list', async (req, res) => {
  const cacheKey = 'match-list';
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    console.log('✅ Serving match-list from cache');
    return res.json(cachedData);
  }

  try {
    // Ensure we have valid tokens before making the API call
    if (tokenManager.tokens.some(token => !token)) {
      console.log('⚠️ Some tokens are missing, attempting renewal...');
      await tokenManager.renewAllTokens();
    }
    
    const data = await fetchData('https://gobook9.com/api/exchange/odds/eventType/4');
    
    if (!data || !data.result) {
      console.error('❌ Invalid data received from API:', data);
      return res.status(500).json({ error: 'Invalid data received from API' });
    }
    
    // Filter out any matches with tabGroupName "Premium Cricket"
    const filteredData = data.result.filter(match => match.tabGroupName !== 'Premium Cricket');
    
    const transformedData = filteredData.map(transformMarketData);

    cache.set(cacheKey, transformedData, 30); // Cache for 30 seconds
    console.log('✅ Serving match-list from API');
    res.json(transformedData);
  } catch (error) {
    console.error('❌ Error fetching match list:', error.message);
    
    // Clear cache on error to force fresh data on next request
    cache.del(cacheKey);
    
    // Try to renew tokens on error
    tokenManager.renewAllTokens().catch(e => console.error('❌ Token renewal failed:', e.message));
    
    res.status(500).json({ error: 'Failed to fetch match list', message: error.message });
  }
});

// ✅ Endpoint to Get Match Details by `groupById`
app.get('/api/match-details/:groupById', async (req, res) => {
  const { groupById } = req.params;
  const cacheKey = `match-details-${groupById}`;
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    console.log(`✅ Serving match-details for ${groupById} from cache`);
    return res.json(cachedData);
  }

  try {
    console.log(`🔎 Fetching details for groupById: ${groupById}`);
    
    // Ensure we have valid tokens before making API calls
    if (tokenManager.tokens.some(token => !token)) {
      console.log('⚠️ Some tokens are missing, attempting renewal...');
      await tokenManager.renewAllTokens();
    }
    
    // First try to get match details with the d-sma-event API format (as shown in curl examples)
    try {
      // Using the format from curl examples: /api/exchange/odds/d-sma-event/4/{groupById}
      const data = await fetchData(`https://gobook9.com/api/exchange/odds/d-sma-event/4/${groupById}`);
      
      if (data && data.result) {
        // Filter out markets with tabGroupName "Premium Cricket"
        const filteredMarkets = data.result.filter(market => market.tabGroupName !== 'Premium Cricket');
        
        // Group markets by their type for better frontend organization
        cache.set(cacheKey, filteredMarkets, 2); // Cache for 2 seconds
        
        console.log(`✅ Serving ${filteredMarkets.length} markets for match ${groupById} using d-sma-event API`);
        return res.json(filteredMarkets);
      }
    } catch (specificError) {
      console.log(`⚠️ d-sma-event API failed: ${specificError.message}. Trying alternative...`);
      // Continue to next approach if specific API fails
    }
    
    // Second attempt: Try the direct event API
    try {
      const data = await fetchData(`https://gobook9.com/api/exchange/odds/event/${groupById}`);
      
      if (data && data.result && data.result.length > 0) {
        // Filter out markets with tabGroupName "Premium Cricket"
        const filteredMarkets = data.result.filter(market => market.tabGroupName !== 'Premium Cricket');
        
        cache.set(cacheKey, filteredMarkets, 2); // Cache for 2 seconds
        
        console.log(`✅ Serving ${filteredMarkets.length} markets for match ${groupById} using event API`);
        return res.json(filteredMarkets);
      }
    } catch (secondError) {
      console.log(`⚠️ Event API failed: ${secondError.message}. Trying fallback...`);
      // Continue to fallback approach if direct event API fails
    }

    // Fallback: Get all matches and filter by groupById
    const allData = await fetchData('https://gobook9.com/api/exchange/odds/eventType/4');
    
    if (!allData || !allData.result) {
      return res.status(500).json({ error: 'Invalid data received from API' });
    }
    
    // Find the match with the matching groupById and filter Premium Cricket
    const matchDetails = allData.result
      .filter(match => String(match.groupById) === String(groupById))
      .filter(match => match.tabGroupName !== 'Premium Cricket');

    if (!matchDetails || matchDetails.length === 0) {
      console.log(`❌ No match found for groupById: ${groupById}`);
      return res.status(404).json({ error: 'Match not found' });
    }

    cache.set(cacheKey, matchDetails, 2); // Cache for 2 seconds
    console.log(`✅ Serving ${matchDetails.length} markets for match ${groupById} (via fallback)`);
    return res.json(matchDetails);
  } catch (error) {
    console.error(`❌ Error fetching match details:`, error.message);
    
    // Clear cache on error to force fresh data on next request
    cache.del(cacheKey);
    
    // Try to renew tokens on error
    tokenManager.renewAllTokens().catch(e => console.error('❌ Token renewal failed:', e.message));
    
    res.status(500).json({ error: 'Failed to fetch match details', message: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server is running on port ${port}`);
});
