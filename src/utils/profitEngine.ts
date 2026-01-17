/**
 * L.E.V.E. Profit Engine - Always Profit Logic
 * 
 * Calculates financial splits for sales based on partnership scenarios
 */

// Partnership configuration from database
export interface PartnershipConfig {
  cost_split_ratio: number | null;      // e.g., 0.5 for 50/50
  profit_share_seller: number | null;   // e.g., 0.7 for 70%
  profit_share_partner: number | null;  // e.g., 0.3 for 30%
}

// Group configuration from database
export interface GroupConfig {
  commission_percent: number | null;    // e.g., 0.2 for 20%
}

// Default values for fallback
const DEFAULT_COST_SPLIT_RATIO = 0.5;       // 50/50
const DEFAULT_PROFIT_SHARE_SELLER = 0.7;    // 70%
const DEFAULT_PROFIT_SHARE_PARTNER = 0.3;   // 30%
const DEFAULT_GROUP_COMMISSION = 0.2;        // 20%

export interface SaleSplitInput {
  salePrice: number;
  costPrice: number;
  groupCommissionPercent?: number; // Legacy - kept for backward compatibility
  isPartnershipStock: boolean;
  sellerIsOwner: boolean;
  hasActivePartnership: boolean;
  // New: Full objects from database
  partnership?: PartnershipConfig | null;
  group?: GroupConfig | null;
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
  
  // Applied configuration (for transparency)
  appliedConfig: {
    costSplitRatio: number;
    profitShareSeller: number;
    profitSharePartner: number;
    groupCommission: number;
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
 * Get configuration values with fallbacks
 */
function getConfigValues(input: SaleSplitInput) {
  const { partnership, group, groupCommissionPercent } = input;
  
  // Cost split ratio with fallback
  const costSplitRatio = partnership?.cost_split_ratio ?? DEFAULT_COST_SPLIT_RATIO;
  
  // Profit shares with fallback
  const profitShareSeller = partnership?.profit_share_seller ?? DEFAULT_PROFIT_SHARE_SELLER;
  const profitSharePartner = partnership?.profit_share_partner ?? DEFAULT_PROFIT_SHARE_PARTNER;
  
  // Group commission with fallback (support both new and legacy format)
  const groupCommission = group?.commission_percent ?? groupCommissionPercent ?? DEFAULT_GROUP_COMMISSION;
  
  return {
    costSplitRatio,
    profitShareSeller,
    profitSharePartner,
    groupCommission
  };
}

/**
 * Calculate sale splits based on L.E.V.E. Always Profit logic
 * 
 * Scenario A: Partnership stock sold by partner (configurable cost split, configurable profit split)
 * Scenario B: Third-party stock via group (owner gets cost + commission, seller keeps rest)
 * Scenario C: Third party sells partnership stock (partnership receives cost + commission, then splits internally)
 */
export function calculateSaleSplits(input: SaleSplitInput): SaleSplitResult {
  const { 
    salePrice, 
    costPrice, 
    isPartnershipStock, 
    sellerIsOwner,
    hasActivePartnership 
  } = input;

  // Get configuration with fallbacks
  const config = getConfigValues(input);
  const { costSplitRatio, profitShareSeller, profitSharePartner, groupCommission } = config;

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
    appliedConfig: {
      costSplitRatio,
      profitShareSeller,
      profitSharePartner,
      groupCommission
    },
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
  // Split: Configurable cost split, configurable profit split
  if (isPartnershipStock && sellerIsOwner && hasActivePartnership) {
    result.scenario = 'A';
    result.scenarioDescription = `Venda de estoque parceria pelo sócio - Split ${(costSplitRatio * 100).toFixed(0)}/${((1 - costSplitRatio) * 100).toFixed(0)} custo, ${(profitShareSeller * 100).toFixed(0)}/${(profitSharePartner * 100).toFixed(0)} lucro`;
    
    const sellerCostRecovery = costPrice * costSplitRatio;
    const partnerCostRecovery = costPrice * (1 - costSplitRatio);
    const sellerProfitShare = totalProfit * profitShareSeller;
    const partnerProfitShare = totalProfit * profitSharePartner;
    
    // Seller gets their cost share + their profit share
    result.seller.costRecovery = sellerCostRecovery;
    result.seller.profitShare = sellerProfitShare;
    result.seller.total = sellerCostRecovery + sellerProfitShare;
    
    // Partner gets their cost share + their profit share
    result.partner.costRecovery = partnerCostRecovery;
    result.partner.profitShare = partnerProfitShare;
    result.partner.total = partnerCostRecovery + partnerProfitShare;
    
    result.splits.push({
      recipientType: 'seller',
      type: 'cost_recovery',
      amount: sellerCostRecovery,
      description: `Recuperação de custo ${(costSplitRatio * 100).toFixed(0)}% - parceria`
    });
    result.splits.push({
      recipientType: 'seller',
      type: 'profit_share',
      amount: sellerProfitShare,
      description: `Lucro ${(profitShareSeller * 100).toFixed(0)}% vendedora - parceria`
    });
    result.splits.push({
      recipientType: 'partner',
      type: 'cost_recovery',
      amount: partnerCostRecovery,
      description: `Recuperação de custo ${((1 - costSplitRatio) * 100).toFixed(0)}% - parceria`
    });
    result.splits.push({
      recipientType: 'partner',
      type: 'profit_share',
      amount: partnerProfitShare,
      description: `Lucro ${(profitSharePartner * 100).toFixed(0)}% sócia - parceria`
    });
    
    return result;
  }

  // Scenario B: Third-party stock via group (seller is NOT the owner)
  // Owner gets: Cost + (TotalProfit * GroupCommission%)
  // Seller keeps: remaining profit
  if (!sellerIsOwner && !isPartnershipStock) {
    result.scenario = 'B';
    result.scenarioDescription = `Venda de estoque de terceiro via grupo - Dono recebe custo + ${(groupCommission * 100).toFixed(0)}% comissão`;
    
    const ownerCommission = totalProfit * groupCommission;
    const ownerTotal = costPrice + ownerCommission;
    const sellerProfit = totalProfit - ownerCommission;
    
    // Owner gets cost recovery + group commission
    result.owner.costRecovery = costPrice;
    result.owner.groupCommission = ownerCommission;
    result.owner.total = ownerTotal;
    
    // Seller keeps remaining profit
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
      description: `Comissão grupo ${(groupCommission * 100).toFixed(0)}% - dono do produto`
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
  // This amount is then split internally using partnership configuration
  if (!sellerIsOwner && isPartnershipStock) {
    result.scenario = 'C';
    result.scenarioDescription = `Terceiro vende peça da parceria - Parceria recebe custo + ${(groupCommission * 100).toFixed(0)}% comissão, split interno ${(costSplitRatio * 100).toFixed(0)}/${((1 - costSplitRatio) * 100).toFixed(0)} custo e ${(profitShareSeller * 100).toFixed(0)}/${(profitSharePartner * 100).toFixed(0)} lucro`;
    
    // What the external seller pays to the partnership
    const partnershipCommission = totalProfit * groupCommission;
    
    // What the seller keeps
    const sellerProfit = totalProfit - partnershipCommission;
    
    // Internal partnership split using configurable ratios
    const ownerCostRecovery = costPrice * costSplitRatio;
    const partnerCostRecovery = costPrice * (1 - costSplitRatio);
    const ownerProfitFromCommission = partnershipCommission * profitShareSeller;
    const partnerProfitFromCommission = partnershipCommission * profitSharePartner;
    
    // Owner (of the product within partnership) gets their cost share + their profit share from commission
    result.owner.costRecovery = ownerCostRecovery;
    result.owner.profitShare = ownerProfitFromCommission;
    result.owner.total = ownerCostRecovery + ownerProfitFromCommission;
    
    // Partner gets their cost share + their profit share from commission
    result.partner.costRecovery = partnerCostRecovery;
    result.partner.profitShare = partnerProfitFromCommission;
    result.partner.total = partnerCostRecovery + partnerProfitFromCommission;
    
    // Seller (third party) keeps remaining profit
    result.seller.profitShare = sellerProfit;
    result.seller.total = sellerProfit;
    
    result.splits.push({
      recipientType: 'owner',
      type: 'cost_recovery',
      amount: ownerCostRecovery,
      description: `Recuperação de custo ${(costSplitRatio * 100).toFixed(0)}% - parceria interna`
    });
    result.splits.push({
      recipientType: 'owner',
      type: 'profit_share',
      amount: ownerProfitFromCommission,
      description: `Lucro ${(profitShareSeller * 100).toFixed(0)}% dono - parceria interna`
    });
    result.splits.push({
      recipientType: 'partner',
      type: 'cost_recovery',
      amount: partnerCostRecovery,
      description: `Recuperação de custo ${((1 - costSplitRatio) * 100).toFixed(0)}% - parceria interna`
    });
    result.splits.push({
      recipientType: 'partner',
      type: 'profit_share',
      amount: partnerProfitFromCommission,
      description: `Lucro ${(profitSharePartner * 100).toFixed(0)}% sócia - parceria interna`
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
