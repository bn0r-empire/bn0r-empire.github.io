/**
 * BinPaste - JavaScript Controller
 * Handles paste loading, navigation, and modal interactions
 */

// Configuration
const CONFIG = {
    pastesFolder: './pastes/', // Folder containing paste files
    pastesIndex: './pastes/index.json' // Index file listing all pastes
};

// State
let pastes = [];
let currentPaste = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    loadPastes();
    initModal();
});

/**
 * Navigation System
 */
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.dataset.page;
            navigateTo(page);
            
            // Update active state
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });
    });
}

function navigateTo(page) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(p => p.classList.remove('active'));
    
    const targetPage = document.getElementById(`${page}-page`);
    if (targetPage) {
        targetPage.classList.add('active');
        
        // Load content based on page
        if (page === 'recent') {
            loadRecentPastes();
        }
    }
}

/**
 * Paste Loading System
 */
async function loadPastes() {
    try {
        // Try to load from index.json
        const response = await fetch(CONFIG.pastesIndex);
        
        if (response.ok) {
            const data = await response.json();
            pastes = data.pastes || [];
        } else {
            // Fallback: Load demo pastes
            pastes = getDemoPastes();
        }
        
        renderPastes();
        updateStats();
    } catch (error) {
        console.error('Error loading pastes:', error);
        pastes = getDemoPastes();
        renderPastes();
        updateStats();
    }
}

/**
 * Parse paste file with metadata format
 * Format:
 * [Title:Example Title]
 * [Author:Anonymous]
 * [Date:2026-03-01]
 * [Tags:code,example]
 * [Views:1337]
 * 
 * Content goes here...
 */
function parsePasteFile(content, filename) {
    const lines = content.split('\n');
    const metadata = {
        id: filename.replace('.txt', ''),
        title: 'Untitled',
        author: 'Anonymous',
        date: new Date().toLocaleDateString(),
        tags: [],
        views: Math.floor(Math.random() * 1000),
        content: ''
    };
    
    let contentStartIndex = 0;
    
    // Parse metadata lines
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('[') && line.includes(':') && line.endsWith(']')) {
            const match = line.match(/\[(.+?):(.+)\]/);
            if (match) {
                const key = match[1].toLowerCase();
                const value = match[2];
                
                switch(key) {
                    case 'title':
                        metadata.title = value;
                        break;
                    case 'author':
                        metadata.author = value;
                        break;
                    case 'date':
                        metadata.date = value;
                        break;
                    case 'tags':
                        metadata.tags = value.split(',').map(t => t.trim());
                        break;
                    case 'views':
                        metadata.views = parseInt(value) || 0;
                        break;
                }
                contentStartIndex = i + 1;
            }
        } else if (line === '') {
            // Empty line after metadata
            contentStartIndex = i + 1;
            break;
        } else {
            // Content has started
            break;
        }
    }
    
    // Get content (everything after metadata)
    metadata.content = lines.slice(contentStartIndex).join('\n').trim();
    metadata.preview = metadata.content.substring(0, 150) + '...';
    
    return metadata;
}

/**
 * Load paste content from file
 */
async function loadPasteContent(filename) {
    try {
        const response = await fetch(`${CONFIG.pastesFolder}${filename}`);
        if (response.ok) {
            const content = await response.text();
            return parsePasteFile(content, filename);
        }
    } catch (error) {
        console.error('Error loading paste:', error);
    }
    return null;
}

/**
 * Render pastes to grid
 */
function renderPastes() {
    const grid = document.getElementById('paste-grid');
    
    if (pastes.length === 0) {
        grid.innerHTML = '<div class="loading-spinner"><p>No pastes found</p></div>';
        return;
    }
    
    grid.innerHTML = '';
    
    pastes.forEach((paste, index) => {
        const card = createPasteCard(paste, index);
        grid.appendChild(card);
    });
}

/**
 * Create paste card element
 */
function createPasteCard(paste, index) {
    const card = document.createElement('div');
    card.className = 'paste-card';
    card.style.animationDelay = `${index * 0.1}s`;
    
    card.innerHTML = `
        <div class="paste-card-header">
            <div>
                <div class="paste-card-title">${escapeHtml(paste.title)}</div>
                <div class="paste-card-id">#${paste.id}</div>
            </div>
            <div class="paste-card-date">${paste.date}</div>
        </div>
        <div class="paste-card-preview">${escapeHtml(paste.preview || paste.content.substring(0, 100))}</div>
        ${paste.tags && paste.tags.length > 0 ? `
            <div class="paste-tags">
                ${paste.tags.map(tag => `<span class="paste-tag">${escapeHtml(tag)}</span>`).join('')}
            </div>
        ` : ''}
        <div class="paste-card-footer">
            <span class="paste-card-author">by ${escapeHtml(paste.author)}</span>
            <span class="paste-card-views">${paste.views} views</span>
        </div>
    `;
    
    card.addEventListener('click', () => openPasteModal(paste));
    
    return card;
}

/**
 * Modal System
 */
function initModal() {
    const modal = document.getElementById('paste-modal');
    const closeBtn = document.getElementById('close-modal');
    const backdrop = document.querySelector('.modal-backdrop');
    const copyBtn = document.getElementById('copy-btn');
    const rawBtn = document.getElementById('raw-btn');
    
    // Close handlers
    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    
    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeModal();
        }
    });
    
    // Copy button
    copyBtn.addEventListener('click', () => {
        const content = document.getElementById('modal-content').textContent;
        navigator.clipboard.writeText(content).then(() => {
            copyBtn.innerHTML = '<span class="btn-icon">✓</span> Copied!';
            setTimeout(() => {
                copyBtn.innerHTML = '<span class="btn-icon">📋</span> Copy';
            }, 2000);
        });
    });
    
    // Raw view button
    rawBtn.addEventListener('click', () => {
        if (currentPaste) {
            const blob = new Blob([currentPaste.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            URL.revokeObjectURL(url);
        }
    });
}

function openPasteModal(paste) {
    currentPaste = paste;
    const modal = document.getElementById('paste-modal');
    
    // Update modal content
    document.getElementById('modal-title').textContent = paste.title;
    document.getElementById('modal-author').textContent = `by ${paste.author}`;
    document.getElementById('modal-date').textContent = paste.date;
    document.getElementById('modal-views').textContent = `${paste.views} views`;
    document.getElementById('modal-content').textContent = paste.content;
    
    // Update tags
    const tagsContainer = document.getElementById('modal-tags');
    if (paste.tags && paste.tags.length > 0) {
        tagsContainer.innerHTML = paste.tags.map(tag => 
            `<span class="paste-tag">${escapeHtml(tag)}</span>`
        ).join('');
        tagsContainer.style.display = 'flex';
    } else {
        tagsContainer.style.display = 'none';
    }
    
    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Increment views (in a real app, this would be server-side)
    paste.views++;
}

function closeModal() {
    const modal = document.getElementById('paste-modal');
    modal.classList.remove('active');
    document.body.style.overflow = 'auto';
}

/**
 * Load recent pastes
 */
function loadRecentPastes() {
    const list = document.getElementById('recent-list');
    
    if (pastes.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--text-muted);">No recent pastes</p>';
        return;
    }
    
    // Sort by date and take recent ones
    const recent = [...pastes].sort((a, b) => {
        return new Date(b.date) - new Date(a.date);
    }).slice(0, 20);
    
    list.innerHTML = '';
    recent.forEach(paste => {
        const card = createPasteCard(paste);
        list.appendChild(card);
    });
}

/**
 * Update stats
 */
function updateStats() {
    const totalPastes = document.getElementById('total-pastes');
    const pasteViews = document.getElementById('paste-views');
    
    // Animate count
    animateValue(totalPastes, 0, pastes.length, 1000);
    
    const totalViews = pastes.reduce((sum, paste) => sum + paste.views, 0);
    animateValue(pasteViews, 0, totalViews, 1000);
}

function animateValue(element, start, end, duration) {
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            element.textContent = Math.floor(end);
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

/**
 * Demo pastes (used when index.json is not available)
 */
function getDemoPastes() {
    return [
        {
            id: 'demo-001',
            title: 'Example Python Script',
            author: 'Anonymous',
            date: '2026-03-01',
            tags: ['python', 'code', 'example'],
            views: 1337,
            content: `#!/usr/bin/env python3
"""
Example Python script demonstrating basic functionality
"""

def main():
    print("Hello from BinPaste!")
    
    # Example list comprehension
    numbers = [x**2 for x in range(10)]
    print(f"Squares: {numbers}")

if __name__ == "__main__":
    main()`,
            preview: '#!/usr/bin/env python3 - Example Python script demonstrating basic functionality...'
        },
        {
            id: 'demo-002',
            title: 'JavaScript Snippet',
            author: 'CodeMaster',
            date: '2026-02-28',
            tags: ['javascript', 'web', 'async'],
            views: 892,
            content: `// Async data fetcher with error handling
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(\`HTTP error! status: \${response.status}\`);
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch failed:', error);
        return null;
    }
}

// Usage
fetchData('https://api.example.com/data')
    .then(data => console.log(data));`,
            preview: 'Async data fetcher with error handling...'
        },
        {
            id: 'demo-003',
            title: 'Linux Commands Cheatsheet',
            author: 'SysAdmin',
            date: '2026-02-27',
            tags: ['linux', 'bash', 'cheatsheet'],
            views: 2453,
            content: `# Essential Linux Commands
            
## File Operations
ls -la          # List all files with details
cd /path        # Change directory
pwd             # Print working directory
cp file dest    # Copy file
mv file dest    # Move/rename file
rm file         # Remove file

## System Info
uname -a        # System information
df -h           # Disk usage
free -m         # Memory usage
top             # Process monitor

## Networking
netstat -tulpn  # Show listening ports
ss -tulpn       # Socket statistics
ip addr show    # Show IP addresses
ping host       # Test connectivity`,
            preview: 'Essential Linux Commands - File Operations, System Info, Networking...'
        },
        {
            id: 'demo-004',
            title: 'SQL Query Examples',
            author: 'DBAdmin',
            date: '2026-02-26',
            tags: ['sql', 'database', 'queries'],
            views: 1654,
            content: `-- Common SQL queries for data analysis

-- Select with conditions
SELECT * FROM users 
WHERE created_at > '2026-01-01' 
AND status = 'active';

-- Join tables
SELECT u.name, o.order_id, o.total
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.total > 100;

-- Aggregation
SELECT category, COUNT(*) as count, AVG(price) as avg_price
FROM products
GROUP BY category
HAVING count > 10
ORDER BY avg_price DESC;`,
            preview: 'Common SQL queries for data analysis...'
        },
        {
            id: 'demo-005',
            title: 'Config File Template',
            author: 'DevOps',
            date: '2026-02-25',
            tags: ['config', 'yaml', 'template'],
            views: 567,
            content: `# Application Configuration
app:
  name: "MyApp"
  version: "1.0.0"
  environment: "production"

database:
  host: "localhost"
  port: 5432
  name: "myapp_db"
  username: "admin"
  pool_size: 10

server:
  host: "0.0.0.0"
  port: 8080
  timeout: 30
  
logging:
  level: "info"
  file: "/var/log/myapp.log"`,
            preview: 'Application Configuration - Database, Server, Logging settings...'
        },
        {
            id: 'demo-006',
            title: 'API Response Example',
            author: 'BackendDev',
            date: '2026-02-24',
            tags: ['api', 'json', 'rest'],
            views: 923,
            content: `{
  "status": "success",
  "data": {
    "user": {
      "id": 12345,
      "username": "john_doe",
      "email": "john@example.com",
      "created_at": "2026-01-15T10:30:00Z",
      "profile": {
        "name": "John Doe",
        "bio": "Software Developer",
        "avatar_url": "https://example.com/avatar.jpg"
      }
    },
    "posts": [
      {
        "id": 1,
        "title": "My First Post",
        "content": "Hello World!",
        "likes": 42
      }
    ]
  },
  "meta": {
    "timestamp": "2026-03-01T12:00:00Z",
    "version": "1.0"
  }
}`,
            preview: 'API Response Example - JSON format with user data and posts...'
        }
    ];
}

/**
 * Utility Functions
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Export for use in other scripts
 */
window.BinPaste = {
    loadPastes,
    addPaste: (paste) => {
        pastes.unshift(paste);
        renderPastes();
        updateStats();
    }
};
