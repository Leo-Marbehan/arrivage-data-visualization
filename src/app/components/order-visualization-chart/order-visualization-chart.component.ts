import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import * as d3 from 'd3';
import { translateVendorProductCategory } from '../../models/organizations.model';
import { OrdersService } from '../../services/orders.service';
import { OrganizationsService } from '../../services/organizations.service';

interface ChartData {
  id: string;
  displayName: string;
  value: number;
}

// Network diagram interfaces
interface Node {
  id: string;
  displayName: string;
  type: 'buyer' | 'vendor';
  value: number; // Number of orders
}

interface Link {
  source: string;
  target: string;
  value: number; // Number of orders between these entities
}

interface NetworkData {
  nodes: Node[];
  links: Link[];
}

@Component({
  selector: 'app-order-visualization-chart',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './order-visualization-chart.component.html',
  styleUrl: './order-visualization-chart.component.scss',
})
export class OrderVisualizationChartComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private organizationsService = inject(OrganizationsService);

  readonly viewMode: WritableSignal<'buyersByVendor' | 'vendorsByBuyer'> =
    signal('buyersByVendor');
  readonly selectedEntityId: WritableSignal<string | null> = signal(null);
  readonly isGlobalView: WritableSignal<boolean> = signal(false);
  readonly focusedNodeId: WritableSignal<string | null> = signal(null);

  // Variables for zoom and pan
  private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any> | null =
    null;
  private mainGroup: d3.Selection<
    SVGGElement,
    unknown,
    HTMLElement,
    any
  > | null = null;
  private zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
  private currentZoom = { scale: 1, x: 0, y: 0 };
  private readonly ZOOM_STEP = 0.3;
  private readonly MIN_ZOOM = 0.2;
  private readonly MAX_ZOOM = 5;

  // Couleurs pour les barres
  private readonly BUYER_COLOR = '#4285F4'; // Bleu Google
  private readonly BUYER_HOVER_COLOR = '#3367D6'; // Bleu Google plus foncé
  private readonly VENDOR_COLOR = '#0F9D58'; // Vert Google
  private readonly VENDOR_HOVER_COLOR = '#0B8043'; // Vert Google plus foncé

  // Cache des noms générés pour les IDs
  private buyerNames = new Map<string, string>();
  private vendorNames = new Map<string, string>();

  // Maps des vendeurs et acheteurs ayant des commandes
  private vendorsWithOrders = new Map<string, number>();
  private buyersWithOrders = new Map<string, number>();

  // Compteurs pour la numérotation des entités
  private vendorCounter = 1;
  private buyerCounter = 1;

  // Traquer tous les liens possibles (pour la vue globale)
  private allLinks = new Map<string, Link>();

  // Charger tous les IDs des commandes et compter les occurrences
  private processOrdersData(): void {
    const orders = this.ordersService.orders.filter(
      order =>
        order.buyerOrganizationId !== '' && order.vendorOrganizationId !== ''
    );

    // Réinitialiser les maps
    this.vendorsWithOrders.clear();
    this.buyersWithOrders.clear();

    // Compter les commandes pour chaque vendeur et acheteur
    for (const order of orders) {
      const vendorId = order.vendorOrganizationId;
      const buyerId = order.buyerOrganizationId;

      if (vendorId) {
        this.vendorsWithOrders.set(
          vendorId,
          (this.vendorsWithOrders.get(vendorId) || 0) + 1
        );
      }

      if (buyerId) {
        this.buyersWithOrders.set(
          buyerId,
          (this.buyersWithOrders.get(buyerId) || 0) + 1
        );
      }
    }
  }

  readonly availableVendors = computed(() => {
    // Ne retourner que les vendeurs qui ont au moins une commande
    const vendorsWithOrdersIds = Array.from(this.vendorsWithOrders.keys());

    // Réinitialiser le compteur
    this.vendorCounter = 1;

    // Fusionner avec les vendeurs connus pour obtenir leurs infos
    const knownVendors = this.organizationsService.vendorOrganizations
      .filter(vendor => vendorsWithOrdersIds.includes(vendor.id))
      .map(vendor => ({
        id: vendor.id,
        displayName: this.getVendorName(vendor.id),
      }));

    // Ajouter les IDs trouvés uniquement dans les commandes
    const extraVendors = vendorsWithOrdersIds
      .filter(id => !knownVendors.some(v => v.id === id))
      .map(id => ({
        id,
        displayName: this.getVendorName(id),
      }));

    // Fusionner et trier par ordre alphabétique du displayName
    return [...knownVendors, ...extraVendors].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  });

  readonly availableBuyers = computed(() => {
    // Ne retourner que les acheteurs qui ont au moins une commande
    const buyersWithOrdersIds = Array.from(this.buyersWithOrders.keys());

    // Réinitialiser le compteur
    this.buyerCounter = 1;

    // Fusionner avec les acheteurs connus pour obtenir leurs infos
    const knownBuyers = this.organizationsService.buyerOrganizations
      .filter(buyer => buyersWithOrdersIds.includes(buyer.id))
      .map(buyer => ({
        id: buyer.id,
        displayName: this.getBuyerName(buyer.id),
      }));

    // Ajouter les IDs trouvés uniquement dans les commandes
    const extraBuyers = buyersWithOrdersIds
      .filter(id => !knownBuyers.some(b => b.id === id))
      .map(id => ({
        id,
        displayName: this.getBuyerName(id),
      }));

    // Fusionner et trier par ordre alphabétique du displayName
    return [...knownBuyers, ...extraBuyers].sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  });

  readonly activeVendors = computed(() => {
    // Pour le mode vendorsByBuyer, on ne veut que les vendeurs qui ont vendu à l'acheteur sélectionné
    if (this.viewMode() !== 'vendorsByBuyer' || !this.selectedEntityId()) {
      return this.availableVendors();
    }

    const buyerId = this.selectedEntityId();
    const vendorIds = this.ordersService.orders
      .filter(order => order.buyerOrganizationId === buyerId)
      .map(order => order.vendorOrganizationId);

    // Créer un Set pour éliminer les doublons
    const uniqueVendorIds = new Set(vendorIds);

    // Filtrer et trier par ordre alphabétique du displayName
    return this.availableVendors().filter(vendor =>
      uniqueVendorIds.has(vendor.id)
    );
  });

  readonly activeBuyers = computed(() => {
    // Pour le mode buyersByVendor, on ne veut que les acheteurs qui ont acheté au vendeur sélectionné
    if (this.viewMode() !== 'buyersByVendor' || !this.selectedEntityId()) {
      return this.availableBuyers();
    }

    const vendorId = this.selectedEntityId();
    const buyerIds = this.ordersService.orders
      .filter(order => order.vendorOrganizationId === vendorId)
      .map(order => order.buyerOrganizationId);

    // Créer un Set pour éliminer les doublons
    const uniqueBuyerIds = new Set(buyerIds);

    // Filtrer et trier par ordre alphabétique du displayName
    return this.availableBuyers().filter(buyer => uniqueBuyerIds.has(buyer.id));
  });

  readonly chartData = computed(() => {
    if (!this.selectedEntityId()) return [];

    const orders = this.ordersService.orders;
    const data: ChartData[] = [];

    if (this.viewMode() === 'buyersByVendor') {
      // Pour un vendeur sélectionné, afficher les acheteurs qui commandent le plus
      const vendorId = this.selectedEntityId();
      if (!vendorId) return [];

      // Regrouper les commandes par acheteur
      const buyerCounts = orders
        .filter(order => order.vendorOrganizationId === vendorId)
        .reduce(
          (acc, order) => {
            const buyerId = order.buyerOrganizationId;
            acc[buyerId] = (acc[buyerId] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

      // Convertir en format pour le graphique
      for (const [buyerId, count] of Object.entries(buyerCounts)) {
        data.push({
          id: buyerId,
          displayName: this.getBuyerName(buyerId),
          value: count,
        });
      }
    } else {
      // Pour un acheteur sélectionné, afficher les vendeurs qui lui vendent le plus
      const buyerId = this.selectedEntityId();
      if (!buyerId) return [];

      // Regrouper les commandes par vendeur
      const vendorCounts = orders
        .filter(order => order.buyerOrganizationId === buyerId)
        .reduce(
          (acc, order) => {
            const vendorId = order.vendorOrganizationId;
            acc[vendorId] = (acc[vendorId] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

      // Convertir en format pour le graphique
      for (const [vendorId, count] of Object.entries(vendorCounts)) {
        data.push({
          id: vendorId,
          displayName: this.getVendorName(vendorId),
          value: count,
        });
      }
    }

    // Trier par nombre de commandes (décroissant) et limiter à 15 entrées maximum
    return data.sort((a, b) => b.value - a.value).slice(0, 15);
  });

  // Updated networkData computed property to handle both global and focused view
  readonly networkData = computed(() => {
    if (this.isGlobalView()) {
      return this.globalNetworkData();
    }

    // The existing filtered view logic
    if (!this.selectedEntityId()) return { nodes: [], links: [] };

    const orders = this.ordersService.orders;
    const networkData: NetworkData = { nodes: [], links: [] };
    const nodeMap = new Map<string, Node>();
    const linkMap = new Map<string, Link>();

    if (this.viewMode() === 'buyersByVendor') {
      // Pour un vendeur sélectionné, afficher les acheteurs connectés
      const vendorId = this.selectedEntityId();
      if (!vendorId) return { nodes: [], links: [] };

      // Ajouter le vendeur sélectionné comme nœud central
      const vendorNode: Node = {
        id: vendorId,
        displayName: this.getVendorName(vendorId),
        type: 'vendor',
        value: this.vendorsWithOrders.get(vendorId) || 0,
      };
      nodeMap.set(vendorId, vendorNode);

      // Filtrer les commandes pour ce vendeur
      const relevantOrders = orders.filter(
        order => order.vendorOrganizationId === vendorId
      );

      // Ajouter les acheteurs et les liens
      for (const order of relevantOrders) {
        const buyerId = order.buyerOrganizationId;

        // Ajouter le nœud acheteur s'il n'existe pas encore
        if (!nodeMap.has(buyerId)) {
          nodeMap.set(buyerId, {
            id: buyerId,
            displayName: this.getBuyerName(buyerId),
            type: 'buyer',
            value: 0,
          });
        }

        // Incrémenter la valeur du nœud
        const buyerNode = nodeMap.get(buyerId)!;
        buyerNode.value += 1;

        // Créer ou mettre à jour le lien
        const linkId = `${vendorId}-${buyerId}`;
        if (!linkMap.has(linkId)) {
          linkMap.set(linkId, {
            source: vendorId,
            target: buyerId,
            value: 1,
          });
        } else {
          const link = linkMap.get(linkId)!;
          link.value += 1;
        }
      }
    } else {
      // Pour un acheteur sélectionné, afficher les vendeurs connectés
      const buyerId = this.selectedEntityId();
      if (!buyerId) return { nodes: [], links: [] };

      // Ajouter l'acheteur sélectionné comme nœud central
      const buyerNode: Node = {
        id: buyerId,
        displayName: this.getBuyerName(buyerId),
        type: 'buyer',
        value: this.buyersWithOrders.get(buyerId) || 0,
      };
      nodeMap.set(buyerId, buyerNode);

      // Filtrer les commandes pour cet acheteur
      const relevantOrders = orders.filter(
        order => order.buyerOrganizationId === buyerId
      );

      // Ajouter les vendeurs et les liens
      for (const order of relevantOrders) {
        const vendorId = order.vendorOrganizationId;

        // Ajouter le nœud vendeur s'il n'existe pas encore
        if (!nodeMap.has(vendorId)) {
          nodeMap.set(vendorId, {
            id: vendorId,
            displayName: this.getVendorName(vendorId),
            type: 'vendor',
            value: 0,
          });
        }

        // Incrémenter la valeur du nœud
        const vendorNode = nodeMap.get(vendorId)!;
        vendorNode.value += 1;

        // Créer ou mettre à jour le lien
        const linkId = `${vendorId}-${buyerId}`;
        if (!linkMap.has(linkId)) {
          linkMap.set(linkId, {
            source: vendorId,
            target: buyerId,
            value: 1,
          });
        } else {
          const link = linkMap.get(linkId)!;
          link.value += 1;
        }
      }
    }

    // Limiter le nombre de nœuds pour éviter un graphique trop dense
    // Trier par valeur (nombre de commandes) et prendre les 15 premiers
    const sortedNodes = Array.from(nodeMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 16); // 15 + le nœud central

    const nodeIds = new Set(sortedNodes.map(node => node.id));

    // Ne garder que les liens entre les nœuds retenus
    const filteredLinks = Array.from(linkMap.values())
      .filter(link => nodeIds.has(link.source) && nodeIds.has(link.target))
      .sort((a, b) => b.value - a.value);

    networkData.nodes = sortedNodes;
    networkData.links = filteredLinks;

    return networkData;
  });

  readonly globalNetworkData = computed(() => {
    const networkData: NetworkData = { nodes: [], links: [] };
    const nodeMap = new Map<string, Node>();
    this.allLinks.clear();

    const orders = this.ordersService.orders;
    // Ne plus limiter le nombre de nœuds
    // const maxNodesToShow = 50; // Limiter le nombre total de nœuds pour éviter la surcharge

    // Build a map of all connections for each node id
    const nodeConnections = new Map<string, Set<string>>();

    // Traiter toutes les commandes pour créer les noeuds et les liens
    for (const order of orders) {
      const vendorId = order.vendorOrganizationId;
      const buyerId = order.buyerOrganizationId;

      if (!vendorId || !buyerId) continue;

      // Ajouter le nœud vendeur s'il n'existe pas encore
      if (!nodeMap.has(vendorId)) {
        nodeMap.set(vendorId, {
          id: vendorId,
          displayName: this.getVendorName(vendorId),
          type: 'vendor',
          value: this.vendorsWithOrders.get(vendorId) || 0,
        });
      }

      // Ajouter le nœud acheteur s'il n'existe pas encore
      if (!nodeMap.has(buyerId)) {
        nodeMap.set(buyerId, {
          id: buyerId,
          displayName: this.getBuyerName(buyerId),
          type: 'buyer',
          value: this.buyersWithOrders.get(buyerId) || 0,
        });
      }

      // Track connections for each node
      if (!nodeConnections.has(vendorId)) {
        nodeConnections.set(vendorId, new Set<string>());
      }
      if (!nodeConnections.has(buyerId)) {
        nodeConnections.set(buyerId, new Set<string>());
      }
      nodeConnections.get(vendorId)!.add(buyerId);
      nodeConnections.get(buyerId)!.add(vendorId);

      // Créer ou mettre à jour le lien
      const linkId = `${vendorId}-${buyerId}`;
      if (!this.allLinks.has(linkId)) {
        this.allLinks.set(linkId, {
          source: vendorId,
          target: buyerId,
          value: 1,
        });
      } else {
        const link = this.allLinks.get(linkId)!;
        link.value += 1;
      }
    }

    // Si nous avons un nœud focalisé, filtrer les nœuds et les liens
    if (this.focusedNodeId() && this.isGlobalView()) {
      const focusedId = this.focusedNodeId()!;
      const connectedNodes = new Set<string>([focusedId]);

      // Use our connection map to get all connected nodes
      if (nodeConnections.has(focusedId)) {
        for (const connectedId of nodeConnections.get(focusedId)!) {
          connectedNodes.add(connectedId);
        }
      }

      // Filtrer les nœuds
      const filteredNodes = Array.from(nodeMap.values()).filter(node =>
        connectedNodes.has(node.id)
      );

      // Filtrer les liens
      const filteredLinks = Array.from(this.allLinks.values()).filter(
        link =>
          (link.source === focusedId || link.target === focusedId) &&
          connectedNodes.has(link.source) &&
          connectedNodes.has(link.target)
      );

      networkData.nodes = filteredNodes;
      networkData.links = filteredLinks;
    } else {
      // Sort nodes by connection count (most connected first)
      const sortedNodes = Array.from(nodeMap.values()).sort((a, b) => {
        const aCount = nodeConnections.has(a.id)
          ? nodeConnections.get(a.id)!.size
          : 0;
        const bCount = nodeConnections.has(b.id)
          ? nodeConnections.get(b.id)!.size
          : 0;

        if (aCount !== bCount) {
          return bCount - aCount; // Sort by connection count first
        }
        return b.value - a.value; // Then by value
      });
      // Ne plus limiter le nombre maximum de nœuds
      // .slice(0, maxNodesToShow);

      const nodeIds = new Set(sortedNodes.map(node => node.id));

      // Ensure we include links for all selected nodes
      const allRelevantLinks = [];

      // First pass: collect all links between selected nodes
      for (const [linkId, link] of this.allLinks.entries()) {
        if (nodeIds.has(link.source) && nodeIds.has(link.target)) {
          allRelevantLinks.push(link);
        }
      }

      // Sort links by value
      allRelevantLinks.sort((a, b) => b.value - a.value);

      // Track which nodes are connected in our visualization
      const connectedInVisualization = new Set<string>();

      // Second pass: ensure all nodes have at least one connection
      const finalLinks = [];

      // Add top links first - montrer plus de liens importants
      const topLinksCount = Math.min(200, allRelevantLinks.length);
      for (let i = 0; i < topLinksCount; i++) {
        if (i < allRelevantLinks.length) {
          const link = allRelevantLinks[i];
          finalLinks.push(link);
          connectedInVisualization.add(link.source);
          connectedInVisualization.add(link.target);
        }
      }

      // Now find any nodes that aren't connected yet
      for (const node of sortedNodes) {
        if (!connectedInVisualization.has(node.id)) {
          // Find the best link for this node
          let bestLink = null;
          let bestValue = 0;
          let bestLinkIsSource = false;

          for (const [linkId, link] of this.allLinks.entries()) {
            const isSource = link.source === node.id;
            const isTarget = link.target === node.id;

            if (
              (isSource && nodeIds.has(link.target)) ||
              (isTarget && nodeIds.has(link.source))
            ) {
              if (link.value > bestValue) {
                bestLink = link;
                bestValue = link.value;
                bestLinkIsSource = isSource;
              }
            }
          }

          if (bestLink) {
            finalLinks.push(bestLink);
            connectedInVisualization.add(node.id);
            connectedInVisualization.add(
              bestLinkIsSource ? bestLink.target : bestLink.source
            );
          }
        }
      }

      networkData.nodes = sortedNodes;
      networkData.links = finalLinks;
    }

    return networkData;
  });

  constructor() {
    // Traiter les données des commandes
    this.processOrdersData();

    // Observer le changement de mode de vue ou d'entité sélectionnée
    effect(() => {
      const data = this.networkData();

      // Effacer toujours le graphique précédent
      d3.select('#chart').selectAll('*').remove();

      if (data.nodes.length > 0) {
        this.renderNetworkDiagram(data);
      }
    });
  }

  ngOnInit(): void {
    // Initialiser les données et le premier rendu
    if (
      this.availableVendors().length > 0 &&
      this.viewMode() === 'buyersByVendor'
    ) {
      this.selectedEntityId.set(this.availableVendors()[0].id);
    } else if (
      this.availableBuyers().length > 0 &&
      this.viewMode() === 'vendorsByBuyer'
    ) {
      this.selectedEntityId.set(this.availableBuyers()[0].id);
    }
  }

  onViewModeChange(mode: 'buyersByVendor' | 'vendorsByBuyer'): void {
    this.viewMode.set(mode);
    // Réinitialiser l'entité sélectionnée
    if (mode === 'buyersByVendor' && this.availableVendors().length > 0) {
      this.selectedEntityId.set(this.availableVendors()[0].id);
    } else if (mode === 'vendorsByBuyer' && this.availableBuyers().length > 0) {
      this.selectedEntityId.set(this.availableBuyers()[0].id);
    } else {
      this.selectedEntityId.set(null);
    }
  }

  onEntitySelectionChange(entityId: string): void {
    this.selectedEntityId.set(entityId);
  }

  // Toggle global view mode
  toggleGlobalView(): void {
    this.isGlobalView.update(value => !value);

    // Reset focused node when toggling
    if (!this.isGlobalView()) {
      this.focusedNodeId.set(null);
    }
  }

  // Reset the focused node
  resetFocus(): void {
    this.focusedNodeId.set(null);
  }

  // Get the name for any node (buyer or vendor)
  getNodeName(nodeId: string): string {
    // Check if it's a known buyer
    if (this.buyerNames.has(nodeId)) {
      return this.getBuyerName(nodeId);
    }
    // Check if it's a known vendor
    if (this.vendorNames.has(nodeId)) {
      return this.getVendorName(nodeId);
    }
    // If we can't identify the type, try to determine based on maps
    if (this.buyersWithOrders.has(nodeId)) {
      return this.getBuyerName(nodeId);
    }
    if (this.vendorsWithOrders.has(nodeId)) {
      return this.getVendorName(nodeId);
    }
    // Default to showing the ID
    return `Entity (${nodeId.slice(-4)})`;
  }

  private getBuyerName(buyerId: string): string {
    if (!this.buyerNames.has(buyerId)) {
      // Extraire les 4 derniers caractères de l'ID pour un identifiant lisible
      const shortId = buyerId.length > 4 ? buyerId.slice(-4) : buyerId;
      const name = `Acheteur (${shortId})`;
      this.buyerNames.set(buyerId, name);
    }
    return this.buyerNames.get(buyerId) || buyerId;
  }

  private getVendorName(vendorId: string): string {
    if (!this.vendorNames.has(vendorId)) {
      // Extraire les 4 derniers caractères de l'ID pour un identifiant lisible
      const shortId = vendorId.length > 4 ? vendorId.slice(-4) : vendorId;
      const name = `Vendeur (${shortId})`;
      this.vendorNames.set(vendorId, name);
    }
    return this.vendorNames.get(vendorId) || vendorId;
  }

  // Zoom in the network diagram
  zoomIn(): void {
    if (this.zoom && this.svg) {
      const newScale = Math.min(
        this.currentZoom.scale + this.ZOOM_STEP,
        this.MAX_ZOOM
      );
      this.zoomTo(newScale);
    }
  }

  // Zoom out the network diagram
  zoomOut(): void {
    if (this.zoom && this.svg) {
      const newScale = Math.max(
        this.currentZoom.scale - this.ZOOM_STEP,
        this.MIN_ZOOM
      );
      this.zoomTo(newScale);
    }
  }

  // Reset zoom to original state
  resetZoom(): void {
    if (this.zoom && this.svg) {
      this.currentZoom = { scale: 1, x: 0, y: 0 };
      this.svg
        .transition()
        .duration(750)
        .call(this.zoom.transform, d3.zoomIdentity);
    }
  }

  // Zoom to a specific scale
  private zoomTo(scale: number): void {
    if (this.zoom && this.svg) {
      // Update current scale
      this.currentZoom.scale = scale;

      // Create a new transform from current values
      const transform = d3.zoomIdentity
        .translate(this.currentZoom.x, this.currentZoom.y)
        .scale(this.currentZoom.scale);

      // Apply the transform with a transition
      this.svg.transition().duration(300).call(this.zoom.transform, transform);
    }
  }

  // Handle zoom event
  private zoomed(event: d3.D3ZoomEvent<SVGSVGElement, unknown>): void {
    if (this.mainGroup) {
      // Store current zoom state
      this.currentZoom = {
        scale: event.transform.k,
        x: event.transform.x,
        y: event.transform.y,
      };

      // Apply the transform
      this.mainGroup.attr('transform', event.transform.toString());
    }
  }

  // Récupérer les catégories de produits d'un vendeur
  private getVendorProductCategories(vendorId: string): string[] {
    const vendor = this.organizationsService.vendorOrganizations.find(
      v => v.id === vendorId
    );
    if (
      !vendor ||
      !vendor.productCategories ||
      vendor.productCategories.length === 0
    ) {
      return ['Catégorie non spécifiée'];
    }

    // Traduire les catégories de produits en français
    return vendor.productCategories.map(cat =>
      translateVendorProductCategory(cat)
    );
  }

  private renderNetworkDiagram(data: NetworkData): void {
    // Définir les dimensions
    const margin = { top: 40, right: 30, bottom: 40, left: 30 };
    const width = 1080 - margin.left - margin.right;
    const height = 600 - margin.top - margin.bottom;

    // Créer le SVG
    const svgContainer = d3
      .select('#chart')
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom);

    // Create zoom behavior
    this.zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([this.MIN_ZOOM, this.MAX_ZOOM])
      .on('zoom', event => this.zoomed(event));

    // Apply zoom to the SVG
    svgContainer.call(this.zoom);

    // Reset zoom when switching views
    if (this.isGlobalView()) {
      this.currentZoom = { scale: 1, x: 0, y: 0 };
      svgContainer.call(this.zoom.transform, d3.zoomIdentity);
    }

    // Create a main group that will be transformed during zoom/pan
    this.svg = svgContainer;
    this.mainGroup = svgContainer
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Créer un groupe pour les liens et les nœuds
    const linksGroup = this.mainGroup.append('g').attr('class', 'links');
    const nodesGroup = this.mainGroup.append('g').attr('class', 'nodes');

    // Créer un titre (fixed position, outside of the zoom group)
    let legendTitle = '';
    if (this.isGlobalView()) {
      legendTitle = this.focusedNodeId()
        ? `Connexions de ${this.getNodeName(this.focusedNodeId()!)}`
        : 'Vue globale du réseau de vendeurs et acheteurs';
    } else {
      legendTitle =
        this.viewMode() === 'buyersByVendor'
          ? "Réseau d'acheteurs connectés à ce vendeur"
          : 'Réseau de vendeurs connectés à cet acheteur';
    }

    svgContainer
      .append('text')
      .attr('class', 'legend-title')
      .attr('x', (width + margin.left + margin.right) / 2)
      .attr('y', 20)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(legendTitle);

    // Convertir les liens pour d3
    const links = data.links.map(d => ({
      source: d.source,
      target: d.target,
      value: d.value,
    }));

    // Préparer les nœuds pour d3
    const nodes = data.nodes.map(d => ({
      id: d.id,
      displayName: d.displayName,
      type: d.type,
      value: d.value,
    }));

    // Adjust force layout parameters based on view mode and number of nodes
    const nodeCount = nodes.length;
    let forceStrength, linkDistance, collideRadius;

    if (this.isGlobalView()) {
      // Paramètres ajustés pour la vue globale avec beaucoup de nœuds
      forceStrength = Math.min(-5, -20 / Math.log(Math.max(nodeCount, 10)));
      linkDistance = Math.min(
        200,
        50 + 100 / (Math.log(Math.max(nodeCount, 10)) / 2)
      );
      collideRadius = (d: any) => Math.sqrt(d.value) * 1.5 + 5;
    } else {
      // Paramètres pour la vue filtrée (moins de nœuds)
      forceStrength = -400;
      linkDistance = 100;
      collideRadius = (d: any) => Math.sqrt(d.value) * 2 + 10;
    }

    // Créer la simulation de force
    const simulation = d3
      .forceSimulation(nodes as any)
      .force(
        'link',
        d3
          .forceLink(links)
          .id((d: any) => d.id)
          .distance(linkDistance)
      )
      .force('charge', d3.forceManyBody().strength(forceStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(collideRadius).iterations(2));

    // Dessiner les liens avec épaisseur proportionnelle à la valeur
    const link = linksGroup
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke-width', (d: any) =>
        Math.max(1, Math.min(5, Math.sqrt(d.value) * 0.5))
      )
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6);

    // Calculer la taille des nœuds en fonction de leur nombre de commandes
    // Ajuster l'échelle pour mieux fonctionner avec un grand nombre de nœuds
    const nodeSize = (d: any) => {
      const baseSize = Math.min(
        20,
        Math.max(5, Math.sqrt(d.value) * (this.isGlobalView() ? 1.5 : 3))
      );
      return this.isGlobalView() && nodeCount > 100 ? baseSize * 0.6 : baseSize;
    };

    // Dessiner les nœuds
    const node = nodesGroup
      .selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .call(
        d3
          .drag()
          .on('start', dragstarted)
          .on('drag', dragged)
          .on('end', dragended) as any
      );

    // Ajouter des cercles pour les nœuds
    node
      .append('circle')
      .attr('r', nodeSize)
      .attr('fill', (d: any) =>
        d.type === 'buyer' ? this.BUYER_COLOR : this.VENDOR_COLOR
      )
      .attr('stroke', (d: any) => {
        // Mettre en évidence le nœud focalisé avec une bordure spéciale
        return d.id === this.focusedNodeId() ? '#FF5722' : '#fff';
      })
      .attr('stroke-width', (d: any) => (d.id === this.focusedNodeId() ? 3 : 2))
      .on('mouseenter', (event: MouseEvent, d: any) => {
        // Mettre en évidence le nœud
        d3.select(event.target as Element).attr(
          'fill',
          d.type === 'buyer' ? this.BUYER_HOVER_COLOR : this.VENDOR_HOVER_COLOR
        );

        // Remove any existing tooltips first to prevent duplicates
        d3.select('body').selectAll('.tooltip').remove();

        // Construire le contenu de l'infobulle
        let tooltipContent = `<strong>${d.displayName}</strong><br>
          ${d.type === 'buyer' ? 'Acheteur' : 'Vendeur'}<br>
          ${d.value} commande(s)<br>`;

        // Ajouter les catégories de produits si c'est un vendeur
        if (d.type === 'vendor') {
          const categories = this.getVendorProductCategories(d.id);
          if (categories.length > 0) {
            tooltipContent += `<div style="margin-top: 5px;"><strong>Catégories:</strong><br>`;
            tooltipContent += categories.map(cat => `- ${cat}`).join('<br>');
            tooltipContent += `</div>`;
          }
        }

        tooltipContent += `<small>ID: ${d.id}</small>
          <div style="margin-top: 5px; font-style: italic;">Cliquez pour filtrer</div>`;

        // Tooltip
        const tooltip = d3
          .select('body')
          .append('div')
          .attr('class', 'tooltip')
          .style('position', 'absolute')
          .style('background-color', 'white')
          .style('border', '1px solid #ddd')
          .style('border-radius', '4px')
          .style('padding', '10px')
          .style('box-shadow', '0 2px 5px rgba(0,0,0,0.1)')
          .style('opacity', 0)
          .style('z-index', 1000)
          .style('pointer-events', 'none')
          .style('max-width', '250px');

        tooltip.transition().duration(200).style('opacity', 0.9);

        tooltip
          .html(tooltipContent)
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 28 + 'px');
      })
      .on('mousemove', function (event: MouseEvent) {
        d3.select('body')
          .select('.tooltip')
          .style('left', event.pageX + 10 + 'px')
          .style('top', event.pageY - 28 + 'px');
      })
      .on('mouseout', function (event: MouseEvent, d: any) {
        d3.select(event.target as Element).attr(
          'fill',
          d.type === 'buyer' ? '#4285F4' : '#0F9D58'
        );

        // Ensure tooltip is removed
        d3.select('body').selectAll('.tooltip').remove();
      })
      .on('click', (_: MouseEvent, d: any) => {
        // Ensure tooltip is removed
        d3.select('body').selectAll('.tooltip').remove();

        // Si nous sommes en mode global, focus sur le nœud
        if (this.isGlobalView()) {
          if (this.focusedNodeId() === d.id) {
            // Si on clique sur le même nœud, réinitialiser le focus
            this.focusedNodeId.set(null);
          } else {
            // Sinon, définir ce nœud comme focus
            this.focusedNodeId.set(d.id);
          }
        } else {
          // En mode standard, changer la sélection d'entité
          if (d.type === 'buyer') {
            this.viewMode.set('vendorsByBuyer');
            this.selectedEntityId.set(d.id);
          } else {
            this.viewMode.set('buyersByVendor');
            this.selectedEntityId.set(d.id);
          }
        }
      });

    // Ajouter des étiquettes pour les nœuds importants
    node
      .append('text')
      .attr('dx', (d: any) => nodeSize(d) + 5)
      .attr('dy', '.35em')
      .text((d: any) => {
        // Afficher uniquement pour les nœuds importants ou le nœud focalisé
        if (
          d.value > 3 ||
          d.id === this.selectedEntityId() ||
          d.id === this.focusedNodeId()
        ) {
          // Tronquer le nom si trop long
          return d.displayName.length > 20
            ? d.displayName.substring(0, 17) + '...'
            : d.displayName;
        }
        return '';
      })
      .style('font-size', '10px')
      .style('fill', '#333');

    // Mise à jour à chaque tick de la simulation
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Fonctions pour le drag & drop des nœuds
    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Légende (fixed position, outside of the zoom group)
    const legend = svgContainer
      .append('g')
      .attr('class', 'legend')
      .attr(
        'transform',
        `translate(${width + margin.left - 90}, ${margin.top + 10})`
      );

    // Légende pour les acheteurs
    legend
      .append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 6)
      .attr('fill', this.BUYER_COLOR);

    legend
      .append('text')
      .attr('x', 15)
      .attr('y', 4)
      .text('Acheteur')
      .style('font-size', '12px');

    // Légende pour les vendeurs
    legend
      .append('circle')
      .attr('cx', 0)
      .attr('cy', 20)
      .attr('r', 6)
      .attr('fill', this.VENDOR_COLOR);

    legend
      .append('text')
      .attr('x', 15)
      .attr('y', 24)
      .text('Vendeur')
      .style('font-size', '12px');

    // Si nous avons un nœud focalisé, ajouter une légende pour celui-ci
    if (this.focusedNodeId()) {
      legend
        .append('circle')
        .attr('cx', 0)
        .attr('cy', 40)
        .attr('r', 6)
        .attr('stroke', '#FF5722')
        .attr('stroke-width', 3)
        .attr('fill', '#fff');

      legend
        .append('text')
        .attr('x', 15)
        .attr('y', 44)
        .text('Nœud sélectionné')
        .style('font-size', '12px');
    }

    // Add zoom instructions text (if in global view)
    if (this.isGlobalView()) {
      svgContainer
        .append('text')
        .attr('class', 'zoom-instructions')
        .attr('x', margin.left + 10)
        .attr('y', margin.top + 10)
        .attr('text-anchor', 'start')
        .style('font-size', '12px')
        .style('fill', '#666')
        .text(
          'Utilisez la souris pour déplacer et zoomer, ou les boutons de zoom'
        );
    }
  }
}
