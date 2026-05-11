document.addEventListener('DOMContentLoaded', async function() {
    // Initialize all variables first
    let tasks = [];
    let notes = [];
    let currentCalendarDate = new Date();
    let selectedDate = new Date().toISOString().split('T')[0];
    let currentMiniCalendarDate = new Date();
    let miniCalendarTarget = null;
    
    // Pomodoro Timer variables
    let timerInterval = null;
    let timeLeft = 25 * 60;
    let isRunning = false;
    let studyTimeToday = parseInt(localStorage.getItem('grevillea_study_time') || '0');
    let currentStreak = parseInt(localStorage.getItem('grevillea_streak') || '0');
    let lastStudyDate = localStorage.getItem('grevillea_last_study_date') || null;
    
    // Get Supabase client
    const supabase = getSupabase();
    
    // USER STATS FUNCTIONS
    async function loadUserStats() {
        if (!supabase) {
            studyTimeToday = parseInt(localStorage.getItem('grevillea_study_time') || '0');
            currentStreak = parseInt(localStorage.getItem('grevillea_streak') || '0');
            lastStudyDate = localStorage.getItem('grevillea_last_study_date') || null;
            updateStreakDisplay();
            return;
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const { data, error } = await supabase
            .from('user_stats')
            .select('*')
            .eq('user_id', user.id);
        
        if (error) {
            console.error('Error loading user stats:', error);
            return;
        }
        
        if (data && data.length > 0) {
            studyTimeToday = data[0].study_time_today || 0;
            currentStreak = data[0].current_streak || 0;
            lastStudyDate = data[0].last_study_date;
            
            localStorage.setItem('grevillea_study_time', studyTimeToday.toString());
            localStorage.setItem('grevillea_streak', currentStreak.toString());
            localStorage.setItem('grevillea_last_study_date', lastStudyDate || '');
        }
        updateStreakDisplay();
        updateStudyTimeDisplay();
    }
    
    async function saveUserStats() {
        if (!supabase) {
            localStorage.setItem('grevillea_study_time', studyTimeToday.toString());
            localStorage.setItem('grevillea_streak', currentStreak.toString());
            localStorage.setItem('grevillea_last_study_date', new Date().toISOString().split('T')[0]);
            return;
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        const today = new Date().toISOString().split('T')[0];
        
        // First check if row exists
        const { data: existing } = await supabase
            .from('user_stats')
            .select('id')
            .eq('user_id', user.id)
            .maybeSingle();
        
        const statsData = {
            user_id: user.id,
            study_time_today: studyTimeToday,
            current_streak: currentStreak,
            last_study_date: today
        };
        
        if (existing) {
            statsData.id = existing.id;
        }
        
        const { error } = await supabase
            .from('user_stats')
            .upsert(statsData);
        
        if (error) {
            console.error('Error saving user stats:', error);
        } else {
            localStorage.setItem('grevillea_study_time', studyTimeToday.toString());
            localStorage.setItem('grevillea_streak', currentStreak.toString());
            localStorage.setItem('grevillea_last_study_date', today);
        }
    }
    
    function updateStreak() {
        const today = new Date().toISOString().split('T')[0];
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        
        if (!lastStudyDate) {
            currentStreak = 1;
        } else if (lastStudyDate === today) {
            // Already studied today, streak continues
        } else if (lastStudyDate === yesterday) {
            currentStreak++;
        } else {
            currentStreak = 1;
        }
        
        lastStudyDate = today;
        updateStreakDisplay();
        saveUserStats();
    }
    
    function updateStreakDisplay() {
        const streakEl = document.getElementById('streak-count');
        if (streakEl) {
            streakEl.textContent = currentStreak;
        }
    }

    // DEFINE ALL FUNCTIONS
    
    function loadUserData() {
        const user = JSON.parse(localStorage.getItem('grevillea_user') || '{}');
        const avatar = document.getElementById('user-avatar');
        if (avatar && user.avatar) {
            avatar.textContent = user.avatar;
            avatar.style.fontSize = '24px';
        } else if (avatar && user.fullname) {
            const initials = user.fullname.split(' ').map(n => n[0]).join('').toUpperCase();
            avatar.textContent = initials.slice(0, 2);
        }
    }
    
    function generateCalendar() {
        const calendarDays = document.getElementById('calendar-days');
        const calendarMonth = document.getElementById('calendar-month');
        if (!calendarDays || !calendarMonth) return;
        
        const year = currentCalendarDate.getFullYear();
        const month = currentCalendarDate.getMonth();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        calendarMonth.textContent = `${monthNames[month]} ${year}`;
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        const today = new Date().toISOString().split('T')[0];
        
        let html = '';
        
        for (let i = firstDay - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            html += `<div class="calendar-day other-month"><span class="calendar-day-number">${day}</span></div>`;
        }
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const dayTasks = tasks.filter(t => t.date === dateStr && !t.completed);
            const taskDots = dayTasks.map(() => '<div class="task-dot"></div>').join('');
            
            html += `
                <div class="calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">
                    <span class="calendar-day-number">${day}</span>
                    <div class="calendar-day-tasks">${taskDots}</div>
                </div>
            `;
        }
        
        const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
        const remainingCells = totalCells - (firstDay + daysInMonth);
        
        for (let day = 1; day <= remainingCells; day++) {
            html += `<div class="calendar-day other-month"><span class="calendar-day-number">${day}</span></div>`;
        }
        
        calendarDays.innerHTML = html;
        
        calendarDays.querySelectorAll('.calendar-day:not(.other-month)').forEach(day => {
            day.addEventListener('click', function() {
                selectedDate = this.dataset.date;
                generateCalendar();
                showTasksForDate(selectedDate);
            });
        });
        
        showTasksForDate(selectedDate);
    }
    
    function showTasksForDate(dateStr) {
        const dayTasksList = document.getElementById('day-tasks-list');
        const selectedDateSpan = document.getElementById('selected-date');
        if (!dayTasksList || !selectedDateSpan) return;
        
        selectedDateSpan.textContent = new Date(dateStr).toLocaleDateString('en-US', { 
            weekday: 'short', month: 'short', day: 'numeric' 
        });
        
        const dayTasks = tasks.filter(t => t.date === dateStr);
        
        if (dayTasks.length === 0) {
            dayTasksList.innerHTML = `<div class="empty-state"><p>No tasks for this date.</p></div>`;
        } else {
            dayTasksList.innerHTML = dayTasks.map((task, idx) => `
                <label class="task-item">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} data-index="${tasks.indexOf(task)}">
                    <span class="task-text ${task.completed ? 'completed' : ''}">${escapeHtml(task.text)}</span>
                    <span class="task-tag">${task.completed ? 'Done' : 'Pending'}</span>
                </label>
            `).join('');
            
            dayTasksList.querySelectorAll('.task-checkbox').forEach(cb => {
                cb.addEventListener('change', function() {
                    const taskIndex = parseInt(this.dataset.index);
                    tasks[taskIndex].completed = this.checked;
                    saveTask(tasks[taskIndex]);
                    generateCalendar();
                    renderTasks();
                    showTasksForDate(selectedDate);
                });
            });
        }
    }
    
    function renderTasks() {
        const taskList = document.getElementById('task-list');
        const taskCountDisplay = document.getElementById('task-count-display');
        if (!taskList) return;
        
        const unchecked = tasks.filter(t => !t.completed).length;
        if (taskCountDisplay) taskCountDisplay.textContent = `${unchecked} pending`;
        
        if (tasks.length === 0) {
            taskList.innerHTML = `<div class="empty-state"><p>No tasks yet. Add your first task below!</p></div>`;
        } else {
            taskList.innerHTML = tasks.map((task, index) => `
                <div class="task-item" data-index="${index}">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
                    <span class="task-text-editable ${task.completed ? 'completed' : ''}">${escapeHtml(task.text)}</span>
                    <span class="task-date-picker" data-index="${index}">${formatDisplayDate(task.date)}</span>
                    <span class="task-tag">${task.completed ? 'Done' : 'Pending'}</span>
                    <button class="task-delete" data-index="${index}" title="Delete task">×</button>
                </div>
            `).join('');
            
            taskList.querySelectorAll('.task-checkbox').forEach(cb => {
                cb.addEventListener('change', function() {
                    const index = parseInt(this.closest('.task-item').dataset.index);
                    tasks[index].completed = this.checked;
                    saveTask(tasks[index]);
                    renderTasks();
                    generateCalendar();
                    updateStats();
                });
            });
            
            taskList.querySelectorAll('.task-text-editable').forEach(textEl => {
                textEl.addEventListener('click', function() {
                    const index = parseInt(this.closest('.task-item').dataset.index);
                    this.contentEditable = true;
                    this.focus();
                    
                    const saveEdit = () => {
                        this.contentEditable = false;
                        const newText = this.textContent.trim();
                        if (newText && newText !== tasks[index].text) {
                            tasks[index].text = newText;
                            saveTask(tasks[index]);
                        }
                        renderTasks();
                    };
                    
                    this.addEventListener('blur', saveEdit, { once: true });
                    this.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            this.blur();
                        }
                    });
                });
            });
            
            taskList.querySelectorAll('.task-date-picker').forEach(dateEl => {
                dateEl.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const index = parseInt(this.dataset.index);
                    showMiniCalendarForTask(index, this);
                });
            });
            
            taskList.querySelectorAll('.task-delete').forEach(delBtn => {
                delBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const index = parseInt(this.dataset.index);
                    if (confirm('Delete this task?')) {
                        const taskToDelete = tasks[index];
                        tasks.splice(index, 1);
                        if (taskToDelete.id) deleteTask(taskToDelete.id);
                        renderTasks();
                        generateCalendar();
                        showTasksForDate(selectedDate);
                    }
                });
            });
        }
        updateStats();
    }
    
    function formatDisplayDate(dateStr) {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y.slice(-2)}`;
    }
    
    function showMiniCalendarForTask(taskIndex, targetEl) {
        const existing = document.querySelector('.mini-calendar-popup');
        if (existing) existing.remove();
        
        // Reset to current month when opening
        currentMiniCalendarDate = new Date();
        
        const popup = document.createElement('div');
        popup.className = 'mini-calendar-popup';
        popup.id = 'mini-calendar-popup';
        popup.style.position = 'fixed';
        popup.style.zIndex = '1000';
        
        const rect = targetEl.getBoundingClientRect();
        popup.style.left = rect.left + 'px';
        popup.style.top = (rect.bottom + 8) + 'px';
        
        renderMiniCalendarForTask(popup, taskIndex);
        document.body.appendChild(popup);
        
        // Attach outside click handler
        setTimeout(() => {
            document.addEventListener('click', outsideClickHandler);
        }, 100);
    }
    
    function outsideClickHandler(e) {
        const popup = document.getElementById('mini-calendar-popup');
        if (popup && !popup.contains(e.target)) {
            closeMiniCalendar();
            document.removeEventListener('click', outsideClickHandler);
        }
    }
    
    function renderMiniCalendarForTask(container, taskIndex) {
        const year = currentMiniCalendarDate.getFullYear();
        const month = currentMiniCalendarDate.getMonth();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date().toISOString().split('T')[0];
        const taskDate = tasks[taskIndex].date;
        
        let html = `
            <div class="mini-calendar-header">
                <button class="mini-prev">&lt;</button>
                <span>${monthNames[month]} ${year}</span>
                <button class="mini-next">&gt;</button>
            </div>
            <div class="mini-calendar-grid">
        `;
        
        for (let i = 0; i < firstDay; i++) html += '<div></div>';
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isSelected = dateStr === taskDate;
            html += `<div class="mini-calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">${day}</div>`;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Use onclick instead of addEventListener to avoid accumulation
        const prevBtn = container.querySelector('.mini-prev');
        const nextBtn = container.querySelector('.mini-next');
        
        if (prevBtn) {
            prevBtn.onclick = (e) => {
                e.stopPropagation();
                console.log('Prev clicked, current month:', currentMiniCalendarDate.getMonth());
                currentMiniCalendarDate.setMonth(currentMiniCalendarDate.getMonth() - 1);
                console.log('New month:', currentMiniCalendarDate.getMonth());
                renderMiniCalendarForTask(container, taskIndex);
            };
        }
        
        if (nextBtn) {
            nextBtn.onclick = (e) => {
                e.stopPropagation();
                console.log('Next clicked, current month:', currentMiniCalendarDate.getMonth());
                currentMiniCalendarDate.setMonth(currentMiniCalendarDate.getMonth() + 1);
                console.log('New month:', currentMiniCalendarDate.getMonth());
                renderMiniCalendarForTask(container, taskIndex);
            };
        }
        
        container.querySelectorAll('.mini-calendar-day').forEach(day => {
            day.addEventListener('click', (e) => {
                e.stopPropagation();
                tasks[taskIndex].date = day.dataset.date;
                saveTask(tasks[taskIndex]);
                renderTasks();
                generateCalendar();
                closeMiniCalendar();
                document.removeEventListener('click', outsideClickHandler);
            });
        });
    }
    
    function closeMiniCalendar() {
        const popup = document.getElementById('mini-calendar-popup');
        if (popup) popup.remove();
    }
    
    async function loadTasks() {
        if (!supabase) {
            // Fallback to localStorage if Supabase not available
            tasks = JSON.parse(localStorage.getItem('grevillea_tasks') || '[]');
            return;
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            tasks = JSON.parse(localStorage.getItem('grevillea_tasks') || '[]');
            return;
        }
        
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .order('createdAt', { ascending: true });
        
        if (error) {
            console.error('Error loading tasks:', error);
            // Fallback to localStorage
            tasks = JSON.parse(localStorage.getItem('grevillea_tasks') || '[]');
        } else {
            tasks = data || [];
            // Cache in localStorage for offline
            localStorage.setItem('grevillea_tasks', JSON.stringify(tasks));
        }
    }
    
    async function saveTask(task) {
        if (!supabase) {
            // Fallback to localStorage
            if (!task.id) task.id = Date.now().toString();
            const existingIndex = tasks.findIndex(t => t.id === task.id);
            if (existingIndex >= 0) {
                tasks[existingIndex] = task;
            } else {
                tasks.push(task);
            }
            localStorage.setItem('grevillea_tasks', JSON.stringify(tasks));
            return;
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('No user logged in');
            return;
        }
        
        const taskWithUser = { ...task, user_id: user.id };
        
        const { data, error } = await supabase
            .from('tasks')
            .upsert(taskWithUser)
            .select()
            .single();
        
        if (error) {
            console.error('Error saving task:', error);
        } else {
            // Update local array
            const index = tasks.findIndex(t => t.id === data.id);
            if (index >= 0) {
                tasks[index] = data;
            } else {
                tasks.push(data);
            }
            // Update cache
            localStorage.setItem('grevillea_tasks', JSON.stringify(tasks));
        }
    }
    
    async function deleteTask(taskId) {
        if (!supabase) {
            // Fallback to localStorage
            tasks = tasks.filter(t => t.id !== taskId);
            localStorage.setItem('grevillea_tasks', JSON.stringify(tasks));
            return;
        }
        
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', taskId);
        
        if (error) {
            console.error('Error deleting task:', error);
        } else {
            tasks = tasks.filter(t => t.id !== taskId);
            localStorage.setItem('grevillea_tasks', JSON.stringify(tasks));
        }
    }
    
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    function updateStats() {
        const unchecked = tasks.filter(t => !t.completed).length;
        const tasksCount = document.getElementById('tasks-count');
        if (tasksCount) tasksCount.textContent = unchecked;
    }
    
    // Format functions
    function formatDateDDMMYY(date) {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = String(date.getFullYear()).slice(-2);
        return `${d}/${m}/${y}`;
    }
    
    function parseDDMMYY(dateStr) {
        const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
        if (!match) return null;
        const [, d, m, y] = match;
        const year = y.length === 2 ? (parseInt(y) < 50 ? 2000 + parseInt(y) : 1900 + parseInt(y)) : parseInt(y);
        return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    
    // Timer functions
    function updateTimerDisplay() {
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) timerDisplay.textContent = formatTime(timeLeft);
    }
    
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    function startTimer() {
        if (!isRunning) {
            isRunning = true;
            const startBtn = document.querySelector('.btn-timer.primary');
            if (startBtn) startBtn.textContent = 'Pause';
            
            timerInterval = setInterval(() => {
                timeLeft--;
                studyTimeToday++;
                updateTimerDisplay();
                updateStudyTimeDisplay();
                
                // Save every minute
                if (studyTimeToday % 60 === 0) {
                    saveUserStats();
                }
                
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    isRunning = false;
                    if (startBtn) startBtn.textContent = 'Start';
                    updateStreak();
                    saveUserStats();
                    alert('Pomodoro session complete! Take a break.');
                    timeLeft = 25 * 60;
                    updateTimerDisplay();
                }
            }, 1000);
        } else {
            pauseTimer();
        }
    }
    
    function pauseTimer() {
        clearInterval(timerInterval);
        isRunning = false;
        const startBtn = document.querySelector('.btn-timer.primary');
        if (startBtn) startBtn.textContent = 'Resume';
    }
    
    function resetTimer() {
        clearInterval(timerInterval);
        isRunning = false;
        timeLeft = 25 * 60;
        const startBtn = document.querySelector('.btn-timer.primary');
        if (startBtn) startBtn.textContent = 'Start';
        updateTimerDisplay();
    }
    
    function updateStudyTimeDisplay() {
        const studyTimeEl = document.getElementById('study-time');
        if (studyTimeEl) {
            const hours = Math.floor(studyTimeToday / 3600);
            const mins = Math.floor((studyTimeToday % 3600) / 60);
            studyTimeEl.textContent = `${hours}h ${mins.toString().padStart(2, '0')}m`;
        }
    }
    
    // Task creation functions
    async function addNewTask() {
        const newTaskInput = document.getElementById('new-task-input');
        const newTaskDate = document.getElementById('new-task-date');
        
        const text = newTaskInput.value.trim();
        const dateStr = newTaskDate.value.trim();
        
        const taskText = text || `Task ${tasks.length + 1}`;
        const taskDate = parseDDMMYY(dateStr) || selectedDate;
        
        const newTask = {
            text: taskText,
            completed: false,
            tag: 'General',
            date: taskDate,
            createdAt: new Date().toISOString()
        };
        
        tasks.push(newTask);
        await saveTask(newTask);
        renderTasks();
        generateCalendar();
        
        newTaskInput.value = '';
        newTaskInput.focus();
    }
    
    function renderMiniCalendarInput(popup, targetInput) {
        const year = currentMiniCalendarDate.getFullYear();
        const month = currentMiniCalendarDate.getMonth();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date().toISOString().split('T')[0];
        const currentInputDate = parseDDMMYY(targetInput.value || '');
        
        let html = `
            <div class="mini-calendar-header">
                <button class="mini-prev" onclick="return false;" style="cursor:pointer;z-index:100;">&lt;</button>
                <span>${monthNames[month]} ${year}</span>
                <button class="mini-next" onclick="return false;" style="cursor:pointer;z-index:100;">&gt;</button>
            </div>
            <div class="mini-calendar-grid">
        `;
        
        for (let i = 0; i < firstDay; i++) html += '<div></div>';
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === today;
            const isSelected = dateStr === currentInputDate;
            html += `<div class="mini-calendar-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dateStr}">${day}</div>`;
        }
        
        html += '</div>';
        popup.innerHTML = html;
        
        // Attach click handlers using addEventListener with capture
        const prevBtn = popup.querySelector('.mini-prev');
        const nextBtn = popup.querySelector('.mini-next');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Prev arrow clicked');
                currentMiniCalendarDate.setMonth(currentMiniCalendarDate.getMonth() - 1);
                renderMiniCalendarInput(popup, targetInput);
            }, true);
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Next arrow clicked');
                currentMiniCalendarDate.setMonth(currentMiniCalendarDate.getMonth() + 1);
                renderMiniCalendarInput(popup, targetInput);
            }, true);
        }
        
        popup.querySelectorAll('.mini-calendar-day').forEach(day => {
            day.onclick = (e) => {
                e.stopPropagation();
                const dateStr = day.dataset.date;
                const [y, m, d] = dateStr.split('-');
                targetInput.value = `${d}/${m}/${y.slice(-2)}`;
                closeMiniCalendar();
                document.removeEventListener('click', outsideClickHandlerInput);
            };
        });
    }
    
    function outsideClickHandlerInput(e) {
        const popup = document.getElementById('mini-calendar-popup');
        if (popup && !popup.contains(e.target)) {
            closeMiniCalendar();
            document.removeEventListener('click', outsideClickHandlerInput);
        }
    }
    
    function showMiniCalendar(targetInput) {
        const existing = document.querySelector('.mini-calendar-popup');
        if (existing) {
            existing.remove();
            document.removeEventListener('click', outsideClickHandlerInput);
        }
        
        miniCalendarTarget = targetInput;
        currentMiniCalendarDate = new Date();
        
        const popup = document.createElement('div');
        popup.className = 'mini-calendar-popup';
        popup.id = 'mini-calendar-popup';
        popup.style.position = 'fixed';
        popup.style.zIndex = '1000';
        
        const rect = targetInput.getBoundingClientRect();
        popup.style.left = rect.left + 'px';
        popup.style.top = (rect.bottom + 8) + 'px';
        
        renderMiniCalendarInput(popup, targetInput);
        document.body.appendChild(popup);
        
        // Delay adding the outside click handler so clicks on the popup don't close it
        setTimeout(() => {
            document.addEventListener('click', outsideClickHandlerInput);
        }, 200);
    }
    
    // NOTES FUNCTIONALITY
    let currentNoteId = null;
    let expandedNotes = new Set();
    
    async function loadNotes() {
        if (!supabase) {
            // Fallback to localStorage
            notes = JSON.parse(localStorage.getItem('grevillea_notes') || '[]');
            return;
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            notes = JSON.parse(localStorage.getItem('grevillea_notes') || '[]');
            return;
        }
        
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', user.id)
            .order('createdAt', { ascending: true });
        
        if (error) {
            console.error('Error loading notes:', error);
            notes = JSON.parse(localStorage.getItem('grevillea_notes') || '[]');
        } else {
            notes = data || [];
            localStorage.setItem('grevillea_notes', JSON.stringify(notes));
        }
    }
    
    async function saveNote(note) {
        if (!supabase) {
            // Fallback to localStorage
            if (!note.id) note.id = Date.now().toString();
            const existingIndex = notes.findIndex(n => n.id === note.id);
            if (existingIndex >= 0) {
                notes[existingIndex] = note;
            } else {
                notes.push(note);
            }
            localStorage.setItem('grevillea_notes', JSON.stringify(notes));
            updateNotesCount();
            return;
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('No user logged in');
            return;
        }
        
        const noteWithUser = { ...note, user_id: user.id };
        
        const { data, error } = await supabase
            .from('notes')
            .upsert(noteWithUser)
            .select()
            .single();
        
        if (error) {
            console.error('Error saving note:', error);
        } else {
            const index = notes.findIndex(n => n.id === data.id);
            if (index >= 0) {
                notes[index] = data;
            } else {
                notes.push(data);
            }
            localStorage.setItem('grevillea_notes', JSON.stringify(notes));
            updateNotesCount();
        }
    }
    
    async function deleteNote(noteId) {
        if (!supabase) {
            notes = notes.filter(n => n.id !== noteId);
            localStorage.setItem('grevillea_notes', JSON.stringify(notes));
            updateNotesCount();
            return;
        }
        
        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', noteId);
        
        if (error) {
            console.error('Error deleting note:', error);
        } else {
            notes = notes.filter(n => n.id !== noteId);
            localStorage.setItem('grevillea_notes', JSON.stringify(notes));
            updateNotesCount();
        }
    }
    
    function updateNotesCount() {
        const notesCount = document.getElementById('notes-count');
        if (notesCount) notesCount.textContent = notes.length;
    }
    
    function formatNoteDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    
    function renderNotesList() {
        const sidebarList = document.getElementById('notes-sidebar-list');
        const recentNotesList = document.getElementById('notes-list');
        
        // Sidebar list
        if (sidebarList) {
            if (notes.length === 0) {
                sidebarList.innerHTML = '<div class="empty-state"><p>No notes yet</p></div>';
            } else {
                sidebarList.innerHTML = notes.map((note, index) => {
                    const isExpanded = expandedNotes.has(note.id);
                    const preview = isExpanded ? note.content : (note.content.substring(0, 50) + (note.content.length > 50 ? '...' : ''));
                    return `
                        <div class="note-item ${note.id === currentNoteId ? 'active' : ''}" data-id="${note.id}">
                            <div class="note-item-header">
                                <span class="note-item-title">${escapeHtml(note.title || 'Untitled')}</span>
                                <span class="note-item-category">${escapeHtml(note.category || 'General')}</span>
                                <button class="note-item-expand" data-id="${note.id}">${isExpanded ? '▲' : '▼'}</button>
                            </div>
                            <div class="note-item-preview">${escapeHtml(preview)}</div>
                            <div class="note-item-date">${formatNoteDate(note.updatedAt || note.createdAt)}</div>
                        </div>
                    `;
                }).join('');
                
                // Click to select note
                sidebarList.querySelectorAll('.note-item').forEach(item => {
                    item.addEventListener('click', function(e) {
                        if (!e.target.classList.contains('note-item-expand')) {
                            const noteId = this.dataset.id;
                            loadNote(noteId);
                        }
                    });
                });
                
                // Expand/collapse button
                sidebarList.querySelectorAll('.note-item-expand').forEach(btn => {
                    btn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        const noteId = this.dataset.id;
                        if (expandedNotes.has(noteId)) {
                            expandedNotes.delete(noteId);
                        } else {
                            expandedNotes.add(noteId);
                        }
                        renderNotesList();
                    });
                });
            }
        }
        
        // Recent notes (dashboard card)
        if (recentNotesList) {
            const recentNotes = notes.slice(-3).reverse();
            if (recentNotes.length === 0) {
                recentNotesList.innerHTML = `
                    <div class="empty-state">
                        <p>No notes yet. Create your first study note!</p>
                    </div>
                `;
            } else {
                recentNotesList.innerHTML = recentNotes.map(note => `
                    <div class="note-preview-item" data-id="${note.id}">
                        <div class="note-preview-title">${escapeHtml(note.title || 'Untitled')}</div>
                        <div class="note-preview-category">${escapeHtml(note.category || 'General')}</div>
                    </div>
                `).join('');
                
                recentNotesList.querySelectorAll('.note-preview-item').forEach(item => {
                    item.addEventListener('click', function() {
                        const noteId = this.dataset.id;
                        scrollToNotes();
                        loadNote(noteId);
                    });
                });
            }
        }
    }
    
    function loadNote(noteId) {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;
        
        currentNoteId = noteId;
        
        const titleInput = document.getElementById('note-title-input');
        const categoryInput = document.getElementById('note-category-input');
        const dateSpan = document.getElementById('note-date');
        const contentTextarea = document.getElementById('note-content');
        
        if (titleInput) titleInput.value = note.title || '';
        if (categoryInput) categoryInput.value = note.category || '';
        if (dateSpan) dateSpan.textContent = 'Last edited: ' + formatNoteDate(note.updatedAt || note.createdAt);
        if (contentTextarea) contentTextarea.value = note.content || '';
        
        renderNotesList(); // Update active state
    }
    
    async function createNewNote() {
        const newNote = {
            id: Date.now().toString(),
            title: '',
            category: '',
            content: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        notes.push(newNote);
        await saveNote(newNote);
        renderNotesList();
        loadNote(newNote.id);
        
        // Focus title
        const titleInput = document.getElementById('note-title-input');
        if (titleInput) titleInput.focus();
    }
    
    async function saveCurrentNote() {
        if (!currentNoteId) return;
        
        const titleInput = document.getElementById('note-title-input');
        const categoryInput = document.getElementById('note-category-input');
        const contentTextarea = document.getElementById('note-content');
        
        const note = notes.find(n => n.id === currentNoteId);
        if (note) {
            note.title = titleInput ? titleInput.value : '';
            note.category = categoryInput ? categoryInput.value : '';
            note.content = contentTextarea ? contentTextarea.value : '';
            note.updatedAt = new Date().toISOString();
            
            await saveNote(note);
            renderNotesList();
            
            // Show saved indicator
            const saveBtn = document.getElementById('btn-save-note');
            if (saveBtn) {
                const originalText = saveBtn.textContent;
                saveBtn.textContent = 'Saved!';
                setTimeout(() => saveBtn.textContent = originalText, 1500);
            }
        }
    }
    
    async function deleteCurrentNote() {
        if (!currentNoteId) return;
        
        if (confirm('Delete this note?')) {
            const noteToDelete = currentNoteId;
            notes = notes.filter(n => n.id !== currentNoteId);
            await deleteNote(noteToDelete);
            
            currentNoteId = null;
            
            // Clear editor
            const titleInput = document.getElementById('note-title-input');
            const categoryInput = document.getElementById('note-category-input');
            const contentTextarea = document.getElementById('note-content');
            
            if (titleInput) titleInput.value = '';
            if (categoryInput) categoryInput.value = '';
            if (contentTextarea) contentTextarea.value = '';
            
            renderNotesList();
        }
    }
    
    function scrollToNotes() {
        const notesSection = document.getElementById('notes-section');
        if (notesSection) {
            notesSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    // INITIALIZE
    loadUserData();
    
    // Load from Supabase first, then render
    await loadUserStats();
    await loadTasks();
    await loadNotes();
    
    generateCalendar();
    renderTasks();
    updateTimerDisplay();
    updateStudyTimeDisplay();
    renderNotesList();
    updateNotesCount();
    
    // Setup event listeners
    const addTaskBtnInline = document.getElementById('add-task-btn');
    if (addTaskBtnInline) addTaskBtnInline.addEventListener('click', addNewTask);
    
    const newTaskInput = document.getElementById('new-task-input');
    if (newTaskInput) {
        newTaskInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') addNewTask();
        });
    }
    
    const newTaskDate = document.getElementById('new-task-date');
    if (newTaskDate) {
        newTaskDate.value = formatDateDDMMYY(new Date());
        newTaskDate.addEventListener('click', function(e) {
            e.stopPropagation();
            showMiniCalendar(this);
        });
    }
    
    const startBtn = document.querySelector('.btn-timer.primary');
    const resetBtn = document.querySelector('.btn-timer:not(.primary)');
    
    if (startBtn) startBtn.addEventListener('click', startTimer);
    if (resetBtn) resetBtn.addEventListener('click', resetTimer);
    
    document.getElementById('prev-month')?.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        generateCalendar();
    });
    
    document.getElementById('next-month')?.addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        generateCalendar();
    });
    
    // Notes event listeners
    const btnAddNote = document.getElementById('btn-add-note');
    const btnSaveNote = document.getElementById('btn-save-note');
    const btnDeleteNote = document.getElementById('btn-delete-note');
    
    if (btnAddNote) btnAddNote.addEventListener('click', createNewNote);
    if (btnSaveNote) btnSaveNote.addEventListener('click', saveCurrentNote);
    if (btnDeleteNote) btnDeleteNote.addEventListener('click', deleteCurrentNote);
    
    // Auto-save on input change
    const noteTitleInput = document.getElementById('note-title-input');
    const noteCategoryInput = document.getElementById('note-category-input');
    const noteContent = document.getElementById('note-content');
    
    if (noteTitleInput) {
        noteTitleInput.addEventListener('input', () => {
            if (currentNoteId) saveCurrentNote();
        });
    }
    
    if (noteCategoryInput) {
        noteCategoryInput.addEventListener('input', () => {
            if (currentNoteId) saveCurrentNote();
        });
    }
    
    if (noteContent) {
        noteContent.addEventListener('input', () => {
            if (currentNoteId) saveCurrentNote();
        });
    }
});
