const axios = require('axios');

class WebhookService {
  constructor() {
    this.webhookUrls = [];
  }

  // Webhook URL 등록
  registerWebhook(url, events = ['property.created', 'property.updated']) {
    this.webhookUrls.push({ url, events });
    console.log(`✅ Webhook 등록: ${url}`);
  }

  // 데이터 업데이트 시 Webhook 전송
  async sendUpdate(event, data) {
    const webhooks = this.webhookUrls.filter(w => w.events.includes(event));
    
    for (const webhook of webhooks) {
      try {
        await axios.post(webhook.url, {
          event,
          timestamp: new Date().toISOString(),
          data
        });
        console.log(`📤 Webhook 전송 성공: ${webhook.url}`);
      } catch (error) {
        console.error(`❌ Webhook 전송 실패: ${webhook.url}`, error.message);
      }
    }
  }

  // 일일 업데이트 요약 전송
  async sendDailySummary(properties) {
    const summary = {
      date: new Date().toISOString().split('T')[0],
      totalProperties: properties.length,
      newProperties: properties.filter(p => p.isNew).length,
      highScoreProperties: properties.filter(p => p.investmentScore >= 70).length,
      properties: properties.slice(0, 10) // 상위 10개만
    };

    await this.sendUpdate('daily.summary', summary);
  }
}

module.exports = WebhookService;