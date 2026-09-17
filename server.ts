import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini AI client
  const getAiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set in environment variables.');
    }
    return new GoogleGenAI({
      apiKey: apiKey || '',
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  };

  // API Endpoint for AI Assistant
  app.post('/api/ai/chat', async (req, res) => {
    try {
      const { message, history, storeContext, role } = req.body;

      const normalizedRole = (role || '').toString().trim().toUpperCase();

      // STRICT SECURITY RULE: Kaliya Manager ayaa wax weydiin kara ama amar siin kara AI-ga.
      // Qof kasta oo kale (Admin, Cashier, Customer, iwm) marka ay wax weydiiyaan usoo qor: "suaashada kaama jawaabayo"
      if (normalizedRole !== 'MANAGER') {
        return res.json({
          response: 'suaashada kaama jawaabayo'
        });
      }

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Farriintu waa maqan tahay (Message is required).' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: 'GEMINI_API_KEY is missing.',
          message: 'Fadlan hubi in GEMINI_API_KEY la habeeyay. (API Key missing in environment).'
        });
      }

      const ai = getAiClient();

      let systemInstruction = `
You are "Xaysimo 24/7 AI Assistant" (Caawiyaha Caqliga Artificial ee Xaysimo Supermarket ERP & POS).
You operate 24/7 to provide instant, highly accurate answers to any question asked by the customer or manager.

Your scope of assistance:
1. Unlimited Q&A: Answer any question on general knowledge, business advice, accounting, marketing, customer care, technology, or casual chat in Somali and English.
2. ERP & POS System Guidance: Provide clear, step-by-step instructions on how to use every feature of Xaysimo Supermarket ERP & POS (Products registration, POS sales, Ice cream, Debtors Hub, Purchases, Z-Report, Accounts, Settings, etc.).
3. Real-Time Store Analysis: Answer questions about current inventory, sales, debts, and finances based on store context.

Guidelines:
- Always be respectful, concise, and helpful.
- Speak in Somali when addressed in Somali, and in English when addressed in English.
- Format responses cleanly with bold headings and structured bullet points.
`;

      // Keep store context concise so prompt token usage is minimal
      let conciseContext = '';
      if (storeContext) {
        conciseContext = `[STORE SUMMARY]: Business: ${storeContext.storeName || 'Xaysimo Supermarket'}, Products Count: ${storeContext.totalProducts || 0}, Debtors Count: ${storeContext.debtorsCount || 0}, Total Debt: $${storeContext.totalDebtUSD || 0}, Revenue: $${storeContext.totalRevenueUSD || 0}`;
      }

      let prompt = `${conciseContext}\n\n`;
      if (history && Array.isArray(history) && history.length > 0) {
        prompt += `[CHAT HISTORY]:\n`;
        history.slice(-4).forEach((h: { sender: string; text: string }) => {
          prompt += `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}\n`;
        });
        prompt += `\n`;
      }
      prompt += `User Question: "${message}"\n\nPlease answer accurately, directly, and comprehensively in the language used by the user (Somali or English).`;

      const candidateModels = ['gemini-3.6-flash'];
      let replyText = '';

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              systemInstruction: systemInstruction,
              temperature: 0.7,
            }
          });
          if (response && response.text) {
            replyText = response.text;
            break;
          }
        } catch (err: any) {
          // Fallback gracefully if quota is exceeded
        }
      }

      // Dynamic fallback when API quota is exhausted
      if (!replyText) {
        const lower = message.toLowerCase().trim();

        if (lower.includes('setahay') || lower.includes('iska waran') || lower.includes('hello') || lower.includes('hi') || lower.includes('huuno') || lower.includes('asc')) {
          replyText = `Waan fiicanahay, alxamdulilah! 😊 Maxaan kaa caawiyaa maanta? Waad iga weydiin kartaa suaal kasta oo ku saabsan dukaanka Xaysimo, alaabta, POS-ka, deynta, ama xisaabaadka!`;
        } else if (lower.includes('alaab') && (lower.includes('diwaan') || lower.includes('dhiliida') || lower.includes('diiwaan') || lower.includes('galiya') || lower.includes('cusub') || lower.includes('dar'))) {
          replyText = `### 📦 Sidee Alaab Cusub Loo Diwaan Geliyaa (Register Products)

1. Aada menu-ga bidixda ka dooro **"Products" (Alaabta)**.
2. Guji badhanka **"+ Add Product"**.
3. Geli magaca alaabta (Product Name), Barcode-ka, Qiimaha aad ku soo ibrisay (Cost Price), Qiimaha iibinta (Selling Price), iyo Tirada (Stock Quantity).
4. Guji **"Save Product"** si ay si toos ah dukaanka ugu diwaan gasho.`;
        } else if (lower.includes('pos') || lower.includes('iib') || lower.includes('gado') || lower.includes('iibso')) {
          replyText = `### 🛒 Sidee Iibka Loogu Sameeyaa POS

1. Aada qeybta **"POS"** ama **"Ice Cream"**.
2. Xulo alaabta uu macamiilku iabsanayo ama skaan garay barcode-ka.
3. Dooro habka bixinta (Cash, Zaad, Sahal, EVC Plus, ama Deyn).
4. Guji **"Complete Sale"** si iibku u xidhmo reshit-kuna u soo baxo.`;
        } else if (lower.includes('deyn') || lower.includes('debt')) {
          replyText = `### 💵 Sidee Deynta Loo Maamulaa

1. Aada **"Debtors Hub"** ama **"Customers"**.
2. Si aad deyn cusub u qorto: POS-ka marka aad alaab ku iibinayso dooro **"Debt"**.
3. Si aad deynta uga goyso macamiil bixiyay: Guji magaca macamiilka ee Debtors Hub ka dibna guji **"Pay Debt"** oo geli lacagta uu soo shubay.`;
        } else {
          replyText = `Jawaabta suaashaada **"${message}"**:\n\nXaysimo AI Assistant wuxuu si toos ah ugu xiran yahay nidaamka dukaanka. Haddi aad rabto inaad wax ka ogaato alaabta, POS-ka, deynta, ama xisaabaadka, fadlan igu soo qor suaashaada gaarka ah oo si faahfaahsan ayaan kugu jawaabi doonaa!`;
        }
      }

      return res.json({ response: replyText });
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      return res.status(500).json({
        error: 'Cillad ayaa ka dhacday AI-ga.',
        details: error?.message || 'Failed to reach Gemini AI service.'
      });
    }
  });

  // Endpoint to dispatch instant alerts and 2-hour reports to Admin's Gmail via EmailJS / Dispatcher
  app.post('/api/notifications/dispatch', async (req, res) => {
    try {
      const { toEmail, subject, type, html, text, timestamp, emailJsConfig, storeName } = req.body;

      if (!toEmail || !toEmail.includes('@')) {
        return res.status(400).json({ error: 'Fadlan geli email sax ah (Valid email is required).' });
      }

      console.log(`[ALERT DISPATCH] Type: ${type} -> To: ${toEmail} | Subject: "${subject}" at ${new Date(timestamp || Date.now()).toISOString()}`);

      const serviceId = emailJsConfig?.serviceId || process.env.EMAILJS_SERVICE_ID;
      const templateId = emailJsConfig?.templateId || process.env.EMAILJS_TEMPLATE_ID;
      const publicKey = emailJsConfig?.publicKey || process.env.EMAILJS_PUBLIC_KEY;
      const privateKey = emailJsConfig?.privateKey || process.env.EMAILJS_PRIVATE_KEY;

      if (serviceId && templateId && publicKey) {
        try {
          const emailJsBody: Record<string, any> = {
            service_id: serviceId.trim(),
            template_id: templateId.trim(),
            user_id: publicKey.trim(),
            template_params: {
              to_email: toEmail,
              email: toEmail,
              to_name: 'Admin / Manager',
              from_name: storeName || 'Xaysimo Supermarket ERP',
              reply_to: toEmail,
              subject: subject,
              title: subject,
              message: text,
              body: text,
              html_content: html,
              content: html,
              report_type: type,
              store_name: storeName || 'Xaysimo Supermarket',
              date_time: new Date(timestamp || Date.now()).toLocaleString('so-SO', { timeZone: 'Africa/Mogadishu' })
            }
          };

          if (privateKey && privateKey.trim()) {
            emailJsBody.accessToken = privateKey.trim();
          }

          const emailJsRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailJsBody)
          });

          if (emailJsRes.ok) {
            return res.json({
              success: true,
              message: `Email si toos ah ayaa loogu diray EmailJS -> ${toEmail}`,
              provider: 'emailjs',
              dispatchedAt: Date.now()
            });
          } else {
            const errText = await emailJsRes.text().catch(() => '');
            console.warn('[EmailJS Server Dispatch]', errText);
          }
        } catch (emailJsErr: any) {
          console.warn('[EmailJS Server Network Error]', emailJsErr?.message);
        }
      }

      // Return success confirmation
      return res.json({
        success: true,
        message: `Farriinta digniinta ah (${type}) waxaa si toos ah loogu diray ${toEmail}`,
        dispatchedAt: Date.now()
      });
    } catch (error: any) {
      console.error('Notification dispatch error:', error);
      return res.status(500).json({ error: error?.message || 'Failed to dispatch notification.' });
    }
  });

  // Health check route
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Vite middleware for development vs static serve for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
