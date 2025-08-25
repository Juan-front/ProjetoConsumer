// server.js
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// Função para processar os itens e opções
function processItems(rawItems) {
  if (!rawItems) return [];

  return rawItems.map((item) => {
    const options = (item.Options || item.options || []).map((opt) => ({
      name: opt.Name || opt.name,
      quantity: opt.Quantity || opt.quantity,
      unitPrice: opt.UnitPrice?.Value || opt.unitPrice || 0,
      totalPrice: opt.TotalPrice?.Value || opt.price || 0,
      observations: opt.SpecialInstructions || opt.observations || "",
    }));

    return {
      name: item.Name || item.name,
      quantity: item.Quantity || item.quantity,
      unitPrice: item.UnitPrice?.Value || item.unitPrice || 0,
      totalPrice: item.TotalPrice?.Value || item.totalPrice || 0,
      observations: item.SpecialInstructions || item.observations || "",
      options: options,
    };
  });
}

// Função para calcular totais considerando opções
function calculateTotal(items, deliveryFee = 0) {
  let subtotal = 0;
  items.forEach((item) => {
    subtotal += item.totalPrice || 0;
    if (item.options) {
      item.options.forEach((opt) => {
        subtotal += opt.totalPrice || 0;
      });
    }
  });
  return {
    subTotal: subtotal,
    deliveryFee: deliveryFee,
    orderAmount: subtotal + deliveryFee,
  };
}

// Função principal para processar o pedido
async function processOrder(pedido) {
  const items = processItems(pedido.Items || pedido.items);
  const deliveryFee = pedido.Total?.OtherFees?.Value || pedido.total?.deliveryFee || 0;
  const totals = calculateTotal(items, deliveryFee);

  const payloadConsumer = {
    merchantId: pedido.Merchant?.Id || pedido.merchant?.id,
    orderId: pedido.Id || pedido.id,
    displayId: pedido.DisplayId || pedido.displayId,
    customer: {
      name: pedido.Customer?.Name || pedido.customer?.name,
      phone: pedido.Customer?.Phone?.Number || pedido.customer?.phone?.number,
      email: pedido.Customer?.Email || pedido.customer?.email,
      address: pedido.Delivery?.DeliveryAddress || pedido.delivery?.deliveryAddress,
    },
    items: items,
    totals: totals,
    payments: pedido.Payments?.Methods || pedido.payments?.methods || [],
    extraInfo: pedido.ExtraInfo || pedido.extraInfo || "",
    orderTiming: pedido.OrderTiming || pedido.orderTiming,
    createdAt: pedido.CreatedAt || pedido.createdAt,
  };

  // Enviar para a API do Consumer
  const response = await axios.post(
    "https://api.consumer.com.br/orders", // URL da API do Consumer
    payloadConsumer,
    {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer SEU_TOKEN_AQUI",
      },
    }
  );

  return response.data;
}

// Endpoint para receber webhooks
app.post("/webhook", async (req, res) => {
  try {
    const webhook = req.body;

    console.log("Webhook recebido:", webhook);

    // Dependendo do evento, processar de formas diferentes
    const event = webhook.LastEvent || webhook.EventCode || "CREATED";

    switch (event) {
      case "CREATED":
      case "PLACED":
        // Novo pedido
        const result = await processOrder(webhook);
        console.log("Pedido enviado para Consumer:", result);
        break;

      case "DELIVERED":
      case "ODR":
        // Pedido finalizado
        console.log("Pedido finalizado:", webhook.OrderId || webhook.id);
        // Aqui você pode atualizar status no seu sistema
        break;

      case "CANCELLED":
      case "CANC":
        console.log("Pedido cancelado:", webhook.OrderId || webhook.id);
        // Atualizar status cancelado
        break;

      default:
        console.log("Evento desconhecido:", event);
    }

    res.status(200).send({ status: "success" });
  } catch (error) {
    console.error("Erro ao processar webhook:", error.response?.data || error.message);
    res.status(500).send({ status: "error", message: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
