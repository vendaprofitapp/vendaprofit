/**
 * L.E.V.E. Profit Engine - Always Profit Logic
 * 
 * Calculates financial splits for sales based on partnership scenarios
 */

export interface SaleSplitInput {
  salePrice: number;
  costPrice: number;
  groupCommissionPercent: number; // e.g., 0.20 for 20%
  isPartnershipStock: boolean;
  sellerIsOwner: boolean;
  hasActivePartnership: boolean;
}

export interface PartnerSplit {
  costRecovery: number;
  profitShare: number;
  total: number;
}

export interface SaleSplitResult {
  scenario: 'A' | 'B' | 'C' | 'OWN_STOCK';
  scenarioDescription: string;
  
  // Financial breakdown
  totalProfit: number;
  costPrice: number;
  salePrice: number;
  
  // Seller's earnings
  seller: {
    costRecovery: number;
    profitShare: number;
    total: number;
  };
  
  // Product owner's earnings (when different from seller)
  owner: {
    costRecovery: number;
    profitShare: number;
    groupCommission: number;
    total: number;
  };
  
  // Partner's earnings (in partnership scenarios)
  partner: {
    costRecovery: number;
    profitShare: number;
    total: number;
  };
  
  // Summary for financial_splits table
  splits: Array<{
    recipientType: 'seller' | 'owner' | 'partner';
    type: 'cost_recovery' | 'profit_share' | 'group_commission';
    amount: number;
    description: string;
  }>;
}

/**
 * Calculate sale splits based on L.E.V.E. Always Profit logic
 * 
 * Scenario A: Partnership stock sold by partner (50/50 cost, 70/30 profit)
 * Scenario B: Third-party stock via group (owner gets cost + commission, seller keeps rest)
 * Scenario C: Third party sells partnership stock (partnership receives cost + commission, then splits internally)
 */
export function calculateSaleSplits(input: SaleSplitInput): SaleSplitResult {
  const { 
    salePrice, 
    costPrice, 
    groupCommissionPercent, 
    isPartnershipStock, 
    sellerIsOwner,
    hasActivePartnership 
  } = input;

  const totalProfit = Math.max(0, salePrice - costPrice);

  // Initialize result structure
  const result: SaleSplitResult = {
    scenario: 'OWN_STOCK',
    scenarioDescription: '',
    totalProfit,
    costPrice,
    salePrice,
    seller: { costRecovery: 0, profitShare: 0, total: 0 },
    owner: { costRecovery: 0, profitShare: 0, groupCommission: 0, total: 0 },
    partner: { costRecovery: 0, profitShare: 0, total: 0 },
    splits: []
  };

  // Own stock sale - no splits needed
  if (sellerIsOwner && !hasActivePartnership) {
    result.scenario = 'OWN_STOCK';
    result.scenarioDescription = 'Venda de estoque próprio sem parceria';
    result.seller.costRecovery = costPrice;
    result.seller.profitShare = totalProfit;
    result.seller.total = salePrice;
    
    result.splits.push({
      recipientType: 'seller',
      type: 'cost_recovery',
      amount: costPrice,
      description: 'Recuperação de custo - estoque próprio'
    });
    result.splits.push({
      recipientType: 'seller',
      type: 'profit_share',
      amount: totalProfit,
      description: 'Lucro total - estoque próprio'
    });
    
    return result;
  }

  // Scenario A: Partnership stock sold by partner
  // Split: 50/50 on cost, 70% seller / 30% partner on profit
  if (isPartnershipStock && sellerIsOwner && hasActivePartnership) {
    result.scenario = 'A';
    result.scenarioDescription = 'Venda de estoque parceria pelo sócio - Split 50/50 custo, 70/30 lucro';
    
    const costSplit = costPrice / 2;
    const sellerProfitShare = totalProfit * 0.70;
    const partnerProfitShare = totalProfit * 0.30;
    
    // Seller gets 50% cost + 70% profit
    result.seller.costRecovery = costSplit;
    result.seller.profitShare = sellerProfitShare;
    result.seller.total = costSplit + sellerProfitShare;
    
    // Partner gets 50% cost + 30% profit
    result.partner.costRecovery = costSplit;
    result.partner.profitShare = partnerProfitShare;
    result.partner.total = costSplit + partnerProfitShare;
    
    result.splits.push({
      recipientType: 'seller',
      type: 'cost_recovery',
      amount: costSplit,
      description: 'Recuperação de custo 50% - parceria'
    });
    result.splits.push({
      recipientType: 'seller',
      type: 'profit_share',
      amount: sellerProfitShare,
      description: 'Lucro 70% vendedora - parceria'
    });
    result.splits.push({
      recipientType: 'partner',
      type: 'cost_recovery',
      amount: costSplit,
      description: 'Recuperação de custo 50% - parceria'
    });
    result.splits.push({
      recipientType: 'partner',
      type: 'profit_share',
      amount: partnerProfitShare,
      description: 'Lucro 30% sócia - parceria'
    });
    
    return result;
  }

  // Scenario B: Third-party stock via group (seller is NOT the owner)
  // Owner gets: Cost + (TotalProfit * GroupCommission%)
  // Seller keeps: remaining 100%
  if (!sellerIsOwner && !isPartnershipStock) {
    result.scenario = 'B';
    result.scenarioDescription = 'Venda de estoque de terceiro via grupo - Dono recebe custo + comissão';
    
    const ownerCommission = totalProfit * groupCommissionPercent;
    const ownerTotal = costPrice + ownerCommission;
    const sellerProfit = totalProfit - ownerCommission;
    
    // Owner gets cost recovery + group commission
    result.owner.costRecovery = costPrice;
    result.owner.groupCommission = ownerCommission;
    result.owner.total = ownerTotal;
    
    // Seller keeps remaining profit (100%)
    result.seller.profitShare = sellerProfit;
    result.seller.total = sellerProfit;
    
    result.splits.push({
      recipientType: 'owner',
      type: 'cost_recovery',
      amount: costPrice,
      description: 'Recuperação de custo - dono do produto'
    });
    result.splits.push({
      recipientType: 'owner',
      type: 'group_commission',
      amount: ownerCommission,
      description: `Comissão grupo ${(groupCommissionPercent * 100).toFixed(0)}% - dono do produto`
    });
    result.splits.push({
      recipientType: 'seller',
      type: 'profit_share',
      amount: sellerProfit,
      description: 'Lucro vendedora - após comissão grupo'
    });
    
    return result;
  }

  // Scenario C: Third party sells partnership stock
  // Partnership receives: Cost + (TotalProfit * GroupCommission%)
  // This amount is then split internally: Cost 50/50, Profit received 70/30
  if (!sellerIsOwner && isPartnershipStock) {
    result.scenario = 'C';
    result.scenarioDescription = 'Terceiro vende peça da parceria - Parceria recebe custo + comissão, split interno 50/50 custo e 70/30 lucro';
    
    // What the external seller pays to the partnership
    const partnershipCommission = totalProfit * groupCommissionPercent;
    const partnershipReceives = costPrice + partnershipCommission;
    
    // What the seller keeps
    const sellerProfit = totalProfit - partnershipCommission;
    
    // Internal partnership split
    const internalCostSplit = costPrice / 2; // 50/50 on cost
    const internalOwnerProfit = partnershipCommission * 0.70; // 70% to owner
    const internalPartnerProfit = partnershipCommission * 0.30; // 30% to partner
    
    // Owner (of the product within partnership) gets 50% cost + 70% of commission profit
    result.owner.costRecovery = internalCostSplit;
    result.owner.profitShare = internalOwnerProfit;
    result.owner.total = internalCostSplit + internalOwnerProfit;
    
    // Partner gets 50% cost + 30% of commission profit
    result.partner.costRecovery = internalCostSplit;
    result.partner.profitShare = internalPartnerProfit;
    result.partner.total = internalCostSplit + internalPartnerProfit;
    
    // Seller (third party) keeps remaining profit
    result.seller.profitShare = sellerProfit;
    result.seller.total = sellerProfit;
    
    result.splits.push({
      recipientType: 'owner',
      type: 'cost_recovery',
      amount: internalCostSplit,
      description: 'Recuperação de custo 50% - parceria interna'
    });
    result.splits.push({
      recipientType: 'owner',
      type: 'profit_share',
      amount: internalOwnerProfit,
      description: 'Lucro 70% dono - parceria interna'
    });
    result.splits.push({
      recipientType: 'partner',
      type: 'cost_recovery',
      amount: internalCostSplit,
      description: 'Recuperação de custo 50% - parceria interna'
    });
    result.splits.push({
      recipientType: 'partner',
      type: 'profit_share',
      amount: internalPartnerProfit,
      description: 'Lucro 30% sócia - parceria interna'
    });
    result.splits.push({
      recipientType: 'seller',
      type: 'profit_share',
      amount: sellerProfit,
      description: 'Lucro vendedora terceira - após comissão parceria'
    });
    
    return result;
  }

  // Fallback: Own stock with partnership (treat as own stock)
  result.scenario = 'OWN_STOCK';
  result.scenarioDescription = 'Venda de estoque próprio';
  result.seller.costRecovery = costPrice;
  result.seller.profitShare = totalProfit;
  result.seller.total = salePrice;
  
  result.splits.push({
    recipientType: 'seller',
    type: 'cost_recovery',
    amount: costPrice,
    description: 'Recuperação de custo - estoque próprio'
  });
  result.splits.push({
    recipientType: 'seller',
    type: 'profit_share',
    amount: totalProfit,
    description: 'Lucro total - estoque próprio'
  });
  
  return result;
}

/**
 * Format currency for display (Brazilian Real)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Validate that splits sum correctly
 */
export function validateSplits(result: SaleSplitResult): boolean {
  const totalDistributed = result.seller.total + result.owner.total + result.partner.total;
  const tolerance = 0.01; // Allow for floating point errors
  
  return Math.abs(totalDistributed - result.salePrice) < tolerance;
}

/**
 * Get scenario description for UI display
 */
export function getScenarioLabel(scenario: SaleSplitResult['scenario']): string {
  const labels: Record<SaleSplitResult['scenario'], string> = {
    'A': 'Parceria Direta',
    'B': 'Venda de Grupo',
    'C': 'Terceiro via Parceria',
    'OWN_STOCK': 'Estoque Próprio'
  };
  return labels[scenario];
}
