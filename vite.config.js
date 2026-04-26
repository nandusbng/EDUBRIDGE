import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html',
        dashboard: 'dashboard.html',
        classes: 'classes.html',
        notes: 'notes.html',
        chat: 'chat.html',
        settings: 'settings.html',
        admin: 'admin.html',
        mentor: 'mentor.html',
        faculty: 'faculty.html',
        my_exams: 'my_exams.html',
        quizzes: 'quizzes.html',
        exam: 'exam.html'
      }
    }
  }
});
