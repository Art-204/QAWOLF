const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  // Launch browser
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const pages = [];  // Array to store all pages
  
  try {
    // Go to first page of Hacker News newest
    const firstPage = await context.newPage();
    await firstPage.goto("https://news.ycombinator.com/newest");
    pages.push(firstPage);

    // Wait for the story elements to load
    await firstPage.waitForSelector('.athing');

    // Get timestamps for the first 100 articles
    const articles = [];
    let currentPage = 1;
    let currentPageObj = firstPage;
    
    while (articles.length < 100) {
      // Get all articles on current page
      const pageArticles = await currentPageObj.$$eval('.athing', (elements, startIndex) => {
        return elements.map((element, index) => {
          const articleId = element.getAttribute('id');
          const titleElement = element.querySelector('.titleline > a');
          const timeElement = element.nextElementSibling.querySelector('.age');
          
          return {
            id: articleId,
            index: startIndex + index,
            title: titleElement ? titleElement.textContent : '',
            timestamp: timeElement ? timeElement.getAttribute('title') : '',
            relativeTime: timeElement ? timeElement.textContent : ''
          };
        });
      }, articles.length);

      articles.push(...pageArticles);

      // If we don't have 100 articles yet, open new page
      if (articles.length < 100) {
        // Get the "more" link URL from current page
        const moreLink = await currentPageObj.$('a.morelink');
        if (!moreLink) {
          throw new Error('Could not find more articles');
        }
        const moreLinkHref = await moreLink.getAttribute('href');
        
        // Open new page with the "more" URL
        const newPage = await context.newPage();
        await newPage.goto(`https://news.ycombinator.com/${moreLinkHref}`);
        await newPage.waitForSelector('.athing');
        
        pages.push(newPage);
        currentPageObj = newPage;
        currentPage++;
      }
    }

    // Trim to exactly 100 articles
    articles.length = 100;

    // Validate chronological order
    let isOrdered = true;
    let firstOutOfOrderIndex = -1;

    for (let i = 1; i < articles.length; i++) {
      const currentTime = new Date(articles[i].timestamp);
      const previousTime = new Date(articles[i-1].timestamp);
      
      if (currentTime > previousTime) {
        isOrdered = false;
        firstOutOfOrderIndex = i;
        break;
      }
    }

    // Print results
    console.log(`\nValidation Results:`);
    console.log(`Total articles checked: ${articles.length}`);
    console.log(`Articles in chronological order (newest to oldest): ${isOrdered}`);
    
    if (!isOrdered) {
      console.log(`\nFirst ordering violation at index ${firstOutOfOrderIndex}:`);
      console.log(`Article ${firstOutOfOrderIndex - 1}: "${articles[firstOutOfOrderIndex - 1].title}"`);
      console.log(`Posted: ${articles[firstOutOfOrderIndex - 1].timestamp}`);
      console.log(`Article ${firstOutOfOrderIndex}: "${articles[firstOutOfOrderIndex].title}"`);
      console.log(`Posted: ${articles[firstOutOfOrderIndex].timestamp}`);
    }

    // Save full results to file for debugging
    const fs = require('fs');
    fs.writeFileSync('article_validation_results.json', JSON.stringify(articles, null, 2));

  } catch (error) {
    console.error('An error occurred:', error);
  }
  
  // Browser remains open for inspection
}

(async () => {
  await sortHackerNewsArticles();
})();
