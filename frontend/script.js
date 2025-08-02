let state = {
    keywords: '',
    currentPost: null,
    posts: [ // Массив с историей сгенерированных постов
        {
            id: '1',
            image: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=400&fit=crop&crop=center',
            text: '🚀 Exciting news! We\'re revolutionizing the way teams collaborate with our innovative platform. Join thousands of satisfied customers who have transformed their workflow. #Innovation #TeamWork #Growth',
            keywords: 'innovative platform, team collaboration, workflow',
            timestamp: new Date(Date.now() - 3600000)
        },
        {
            id: '2',
            image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=400&fit=crop&crop=center',
            text: '📊 Data-driven decisions lead to exceptional results! Our analytics dashboard helps you understand your customers better and optimize your strategy for maximum impact. #Analytics #DataScience #Business',
            keywords: 'analytics dashboard, data-driven, customer insights',
            timestamp: new Date(Date.now() - 7200000)
        }
    ],
    isGeneratingImage: false, // Статус генерации изображения
    isGeneratingText: false, // Статус генерации текста
    autoMode: false, // Режим авто-генерации
    interval: 30, // Интервал авто-генерации (в минутах)
    timeRemaining: 0, // Время до следующей авто-генерации
    timer: null // Таймер для авто-генерации
};

// DOM Elements
const elements = {
    keywords: document.getElementById('keywords'), // Поле ввода для ключевых слов
    generateImage: document.getElementById('generateImage'), // Кнопка генерации изображения
    generateText: document.getElementById('generateText'), // Кнопка генерации текста
    autoMode: document.getElementById('autoMode'), // Переключатель авто-генерации
    interval: document.getElementById('interval'), // Поле ввода интервала для авто-генерации
    toggleTimer: document.getElementById('toggleTimer'), // Кнопка запуска/остановки таймера
    timerDisplay: document.getElementById('timerDisplay'), // Отображение времени до авто-генерации
    postPreview: document.getElementById('postPreview'), // Превью поста
    historyList: document.getElementById('historyList'), // История сгенерированных постов
    postCount: document.getElementById('postCount') // Счётчик сгенерированных постов
};

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60); // Преобразуем время в минуты
    const secs = seconds % 60; // Остаток секунд
    return `${mins}:${secs.toString().padStart(2, '0')}`;  // Возвращаем в формате "минуты:секунды"
}

function formatDate(date) {
// Форматируем дату для отображения
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Генерация текста с использованием API
async function generateText(prompt) {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer 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"
        },
        body: JSON.stringify({
            model: "mistralai/mistral-7b-instruct",
            messages: [
                { role: "system", content: "Ты креативный ассистент, который пишет посты для социальных сетей на русском языке." },
                { role: "user", content: `Напиши короткий пост для соцсетей на тему: ${prompt}. Пост должен быть на русском языке.` }
            ],
            temperature: 0.7,
            max_tokens: 150
        })
    });

    const data = await response.json();

    if (!response.ok) {
        console.error("API error:", response.status, data);
        throw new Error("Text generation failed");
    }

    return data.choices[0].message.content.trim(); // Возвращаем сгенерированный текст
}

// Генерация изображения с использованием API
async function generateImage(prompt) {
    const response = await fetch("http://localhost:5001/generate-image", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt }) // Отправляем запрос с ключевыми словами
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error("Image generation error:", errorText);
        throw new Error("Image generation failed");
    }

    const data = await response.json();
    return data.image; // Возвращаем base64 строку изображения
}


// Обновление состояния кнопок (включение/выключение)
function updateButtonStates() {
    const hasKeywords = state.keywords.trim().length > 0;
    elements.generateImage.disabled = !hasKeywords || state.isGeneratingImage;
    elements.generateText.disabled = !hasKeywords || state.isGeneratingText;
}

function updateLoadingStates() {
    const imageBtn = elements.generateImage;
    const imageSpinner = imageBtn.querySelector('.loading-spinner');
    const imageText = imageBtn.querySelector('span');

    if (state.isGeneratingImage) {
        imageSpinner.style.display = 'flex';
        imageText.style.display = 'none';
    } else {
        imageSpinner.style.display = 'none';
        imageText.style.display = 'inline';
    }

    const textBtn = elements.generateText;
    const textSpinner = textBtn.querySelector('.loading-spinner');
    const textText = textBtn.querySelector('span');

    if (state.isGeneratingText) {
        textSpinner.style.display = 'flex';
        textText.style.display = 'none';
    } else {
        textSpinner.style.display = 'none';
        textText.style.display = 'inline';
    }
}

function updateTimerDisplay() {
    const timerValue = elements.timerDisplay.querySelector('.timer-value');
    if (timerValue) {
        timerValue.textContent = formatTime(state.timeRemaining);
    }
}

function updatePostPreview() {
    if (!state.currentPost) {
        elements.postPreview.innerHTML = `
            <div class="preview-placeholder">
                <div class="placeholder-icon">
                    <i class="fas fa-image"></i>
                </div>
                <p>Generate content to see preview</p>
            </div>
        `;
        return;
    }

    // Проверяем, что изображение является base64 или ссылкой
    const imageSrc = state.currentPost.image.startsWith('data:image')
        ? state.currentPost.image  // если это base64
        : state.currentPost.image; // если это URL

    elements.postPreview.innerHTML = `
        <div class="post-content">
            <div class="post-image">
                <img src="${imageSrc}" alt="Generated post image" loading="lazy">
            </div>
            <div class="post-text">
                <p>${state.currentPost.text}</p>
            </div>
            <div class="post-actions">
                <button class="btn btn-primary btn-small" onclick="downloadImage()">
                    <i class="fas fa-download"></i>
                    Download Image
                </button>
                <button class="btn btn-secondary btn-small" onclick="copyText()">
                    <i class="fas fa-copy"></i>
                    <span id="copyBtnText">Copy Text</span>
                </button>
            </div>
        </div>
    `;
}


function updateHistoryList() {
    elements.postCount.textContent = `${state.posts.length} posts`;

    if (state.posts.length === 0) {
        elements.historyList.innerHTML = `
            <div class="history-empty">
                <p>No posts generated yet</p>
            </div>
        `;
        return;
    }

    elements.historyList.innerHTML = state.posts.map(post => `
        <div class="history-item" onclick="selectPost('${post.id}')">
            <div class="history-content">
                <div class="history-thumbnail">
                    <img src="${post.image}" alt="Post thumbnail" loading="lazy">
                </div>
                <div class="history-details">
                    <div class="history-header">
                        <div class="history-title">${post.keywords.split(',')[0] || 'Untitled Post'}</div>
                        <div class="history-actions">
                            <button class="dropdown-btn" onclick="toggleDropdown(event, '${post.id}')">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="dropdown-menu" id="dropdown-${post.id}">
                                <button class="dropdown-item" onclick="downloadImageFromHistory('${post.id}')">
                                    <i class="fas fa-download"></i>
                                    Download Image
                                </button>
                                <button class="dropdown-item" onclick="copyTextFromHistory('${post.id}')">
                                    <i class="fas fa-copy"></i>
                                    Copy Text
                                </button>
                                <button class="dropdown-item destructive" onclick="deletePost('${post.id}')">
                                    <i class="fas fa-trash"></i>
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="history-text">${post.text}</div>
                    <div class="history-date">${formatDate(post.timestamp)}</div>
                </div>
            </div>
        </div>
    `).join('');
}

async function handleGenerateImage() {
    if (!state.keywords.trim() || state.isGeneratingImage) return;

    state.isGeneratingImage = true;
    updateButtonStates();
    updateLoadingStates();

    try {
        // Отправляем запрос на сервер
        const response = await fetch("http://localhost:5001/generate-image", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ prompt: state.keywords })
        });

        // Проверяем, что ответ успешный
        const data = await response.json();

        if (data.success) {
            // Устанавливаем полученное изображение в состояние
            const newPost = {
                id: Date.now().toString(),
                image: data.image,  // Это base64 строка изображения
                text: state.currentPost?.text || "Generated image - add text with 'Generate Post Text' button",
                keywords: state.keywords,
                timestamp: new Date()
            };

            state.currentPost = newPost;
            updatePostPreview();
        } else {
            alert('Error generating image: ' + data.error);  // Показываем ошибку пользователю
        }
    } catch (error) {
        console.error('Error generating image:', error);
        alert('Error generating image. Please try again.');
    } finally {
        state.isGeneratingImage = false;
        updateButtonStates();
        updateLoadingStates();
    }
}



async function handleGenerateText() {
    if (!state.keywords.trim() || state.isGeneratingText) return;

    state.isGeneratingText = true;
    updateButtonStates();
    updateLoadingStates();

    try {
        const generatedText = await generateText(state.keywords);
        const newPost = {
            id: Date.now().toString(),
            image: state.currentPost?.image || 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=400&h=400&fit=crop&crop=center',
            text: generatedText,
            keywords: state.keywords,
            timestamp: new Date()
        };

        state.currentPost = newPost;
        updatePostPreview();
        autoSavePost();
    } catch (error) {
        console.error('Error generating text:', error);
        alert('Error generating text. Please try again.');
    } finally {
        state.isGeneratingText = false;
        updateButtonStates();
        updateLoadingStates();
    }
}

async function handleAutoGenerate() {
    if (!state.keywords.trim()) return;

    state.isGeneratingImage = true;
    state.isGeneratingText = true;
    updateButtonStates();
    updateLoadingStates();

    try {
        const [imageUrl, generatedText] = await Promise.all([
            generateImage(state.keywords),
            generateText(state.keywords)
        ]);

        const newPost = {
            id: Date.now().toString(),
            image: imageUrl,
            text: generatedText,
            keywords: state.keywords,
            timestamp: new Date()
        };

        state.currentPost = newPost;
        state.posts.unshift(newPost);

        updatePostPreview();
        updateHistoryList();
    } catch (error) {
        console.error('Error in auto generation:', error);
    } finally {
        state.isGeneratingImage = false;
        state.isGeneratingText = false;
        updateButtonStates();
        updateLoadingStates();
    }
}

function autoSavePost() {
    if (state.currentPost &&
        state.currentPost.image &&
        state.currentPost.text &&
        state.currentPost.text !== "Generated image - add text with 'Generate Post Text' button" &&
        !state.posts.some(p => p.id === state.currentPost.id)) {

        state.posts.unshift(state.currentPost);
        updateHistoryList();
    }
}

function toggleAutoMode() {
    state.autoMode = !state.autoMode;

    if (state.autoMode) {
        startTimer();
    } else {
        stopTimer();
    }

    updateTimerUI();
}

function startTimer() {
    state.timeRemaining = state.interval * 60;
    elements.timerDisplay.style.display = 'block';
    elements.interval.disabled = true;

    state.timer = setInterval(() => {
        state.timeRemaining--;
        updateTimerDisplay();

        if (state.timeRemaining <= 0) {
            handleAutoGenerate();
            state.timeRemaining = state.interval * 60;
        }
    }, 1000);
}

function stopTimer() {
    if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
    }

    state.timeRemaining = 0;
    elements.timerDisplay.style.display = 'none';
    elements.interval.disabled = false;
}

function updateTimerUI() {
    const toggleBtn = elements.toggleTimer;
    const icon = toggleBtn.querySelector('i');

    if (state.autoMode) {
        toggleBtn.textContent = 'Stop Auto Mode';
        toggleBtn.className = 'btn btn-destructive';
        toggleBtn.insertAdjacentHTML('afterbegin', '<i class="fas fa-pause"></i> ');
    } else {
        toggleBtn.textContent = 'Start Auto Mode';
        toggleBtn.className = 'btn btn-outline';
        toggleBtn.insertAdjacentHTML('afterbegin', '<i class="fas fa-play"></i> ');
    }
}

window.selectPost = function(id) {
    const post = state.posts.find(p => p.id === id);
    if (post) {
        state.currentPost = post;
        state.keywords = post.keywords;
        elements.keywords.value = state.keywords;
        updatePostPreview();
        updateButtonStates();
    }
}

window.deletePost = function(id) {
    if (confirm('Are you sure you want to delete this post?')) {
        state.posts = state.posts.filter(p => p.id !== id);
        if (state.currentPost?.id === id) {
            state.currentPost = null;
            updatePostPreview();
        }
        updateHistoryList();
        closeAllDropdowns();
    }
}

window.toggleDropdown = function(event, id) {
    event.stopPropagation();
    closeAllDropdowns();
    const dropdown = document.getElementById(`dropdown-${id}`);
    dropdown.classList.toggle('show');
}

window.closeAllDropdowns = function() {
    document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('show');
    });
}

window.downloadImage = function() {
    if (state.currentPost?.image) {
        const link = document.createElement('a');
        link.href = state.currentPost.image;
        link.download = `social-post-${state.currentPost.id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

window.downloadImageFromHistory = function(id) {
    const post = state.posts.find(p => p.id === id);
    if (post?.image) {
        const link = document.createElement('a');
        link.href = post.image;
        link.download = `social-post-${id}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    closeAllDropdowns();
}

window.copyText = function() {
    if (state.currentPost?.text) {
        navigator.clipboard.writeText(state.currentPost.text).then(() => {
            const btnText = document.getElementById('copyBtnText');
            const originalText = btnText.textContent;
            btnText.textContent = 'Copied!';
            btnText.parentElement.classList.add('text-success');

            setTimeout(() => {
                btnText.textContent = originalText;
                btnText.parentElement.classList.remove('text-success');
            }, 2000);
        });
    }
}

window.copyTextFromHistory = function(id) {
    const post = state.posts.find(p => p.id === id);
    if (post?.text) {
        navigator.clipboard.writeText(post.text);
    }
    closeAllDropdowns();
}

document.addEventListener('DOMContentLoaded', function() {
    elements.keywords.addEventListener('input', function(e) {
        state.keywords = e.target.value;
        updateButtonStates();
    });

    elements.generateImage.addEventListener('click', handleGenerateImage);
    elements.generateText.addEventListener('click', handleGenerateText);

    elements.autoMode.addEventListener('change', toggleAutoMode);
    elements.interval.addEventListener('change', function(e) {
        state.interval = parseInt(e.target.value);
    });
    elements.toggleTimer.addEventListener('click', toggleAutoMode);

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.history-actions')) {
            closeAllDropdowns();
        }
    });

    updateButtonStates();
    updatePostPreview();
    updateHistoryList();
    updateTimerDisplay();
});
