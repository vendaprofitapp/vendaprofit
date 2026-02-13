
ALTER TABLE public.store_settings 
ADD COLUMN purchase_incentives_config jsonb DEFAULT '{
  "enabled": false,
  "installments": {
    "enabled": true,
    "max_installments": 3,
    "min_amount_per_installment": 30,
    "no_interest": true
  },
  "pix_discount": {
    "enabled": true,
    "discount_percent": 5
  },
  "tiers": [
    {"min_value": 250, "benefit": "Frete grátis SP", "emoji": "truck"},
    {"min_value": 350, "benefit": "Frete grátis + mimo", "emoji": "gift"},
    {"min_value": 500, "benefit": "Brinde premium", "emoji": "star"},
    {"min_value": 700, "benefit": "Cliente VIP (cupom próximo pedido)", "emoji": "crown"}
  ],
  "messages": {
    "on_add": "Falta só mais uma peça para parcelar em 4x ;)",
    "near_free_shipping": "Você está a R${remaining} do frete grátis!",
    "unlocked_free_shipping": "Parabéns! Você ganhou frete grátis!",
    "unlocked_gift": "Seu pedido ganhou um presente!"
  }
}'::jsonb;
